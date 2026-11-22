"""Fluxo principal: comprar ingresso (Descrição do Sistema, seção 2).

1. Cria o pedido (CRIADO).
2. Pede ao Eventos a reserva das vagas -> RESERVADO. Sem vagas: CANCELADO (409).
3. Pede ao Pagamento a cobrança -> PAGO. Recusa ou falha: libera as vagas, CANCELADO (402/503).
4. Emite os ingressos -> CONCLUIDO (201).
5. Pede ao Notificações a confirmação. Se falhar, só registra; a compra não é afetada.
"""
import logging

from sqlalchemy.orm import Session

from .gateways import (
    EventoNaoEncontrado,
    EventosGateway,
    NotificacaoGateway,
    PagamentoGateway,
    SemVagas,
    ServicoIndisponivel,
)
from .models import Ingresso, Pedido

log = logging.getLogger("ingressos")


class CompraFalhou(Exception):
    """A compra terminou com o pedido CANCELADO. Carrega o status HTTP da resposta."""

    def __init__(self, status: int, mensagem: str, pedido: Pedido, **extra):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem
        self.pedido = pedido
        self.extra = extra


class CompraService:
    def __init__(self, db: Session, eventos: EventosGateway, pagamento: PagamentoGateway, notificacao: NotificacaoGateway):
        self.db = db
        self.eventos = eventos
        self.pagamento = pagamento
        self.notificacao = notificacao

    def _cancelar(self, pedido: Pedido, status: int, motivo: str, liberar: bool, **extra) -> CompraFalhou:
        if liberar:
            try:
                self.eventos.liberar(pedido.evento_id, pedido.id)
            except ServicoIndisponivel:
                # Eventos também caiu: a reserva fica registrada lá e pode ser liberada depois.
                log.error("Não foi possível liberar as vagas do pedido %s: Eventos indisponível", pedido.id)
        pedido.cancelar(motivo)
        self.db.commit()
        log.info("Pedido %s CANCELADO (%s): %s", pedido.id, status, motivo)
        return CompraFalhou(status, motivo, pedido, **extra)

    def comprar(self, evento_id: int, participante: str, email: str, quantidade: int, meio: str, final_cartao: str | None) -> Pedido:
        pedido = Pedido(
            evento_id=evento_id,
            participante=participante,
            email=email,
            quantidade=quantidade,
            meio=meio,
            final_cartao=final_cartao if meio == "CARTAO" else None,
            estado="CRIADO",
        )
        self.db.add(pedido)
        self.db.commit()

        # 1. Evento e preço
        try:
            evento = self.eventos.obter_evento(evento_id)
        except ServicoIndisponivel as e:
            raise self._cancelar(pedido, 503, str(e), liberar=False)
        except EventoNaoEncontrado:
            raise self._cancelar(pedido, 404, "Evento não encontrado.", liberar=False)
        pedido.valor_total = round(evento.preco * quantidade, 2)

        # 2. Reserva de vagas
        try:
            self.eventos.reservar(evento_id, pedido.id, quantidade)
        except ServicoIndisponivel as e:
            # A reserva pode ter sido gravada antes do timeout; liberar é idempotente.
            raise self._cancelar(pedido, 503, str(e), liberar=True)
        except EventoNaoEncontrado:
            raise self._cancelar(pedido, 404, "Evento não encontrado.", liberar=False)
        except SemVagas as e:
            raise self._cancelar(pedido, 409, "sem vagas suficientes", liberar=False, vagas_disponiveis=e.vagas_disponiveis)
        pedido.reservar()
        self.db.commit()

        # 3. Cobrança
        try:
            resultado = self.pagamento.cobrar(pedido.id, pedido.valor_total, meio, pedido.final_cartao)
        except ServicoIndisponivel as e:
            raise self._cancelar(pedido, 503, str(e), liberar=True)
        pedido.pagamento_id = resultado.pagamento_id
        if not resultado.aprovado:
            raise self._cancelar(pedido, 402, "pagamento recusado, vagas liberadas", liberar=True)
        pedido.pagar()

        # 4. Emissão dos ingressos
        for n in range(1, quantidade + 1):
            self.db.add(Ingresso(codigo=f"TF-{evento_id}-{pedido.id}-{n}", pedido=pedido, evento_id=evento_id, estado="EMITIDO"))
        pedido.concluir()
        self.db.commit()
        log.info("Pedido %s CONCLUIDO: %s ingresso(s)", pedido.id, quantidade)

        # 5. Confirmação (falha só é registrada)
        codigos = ", ".join(i.codigo for i in pedido.ingressos)
        try:
            self.notificacao.enviar(
                email,
                f"Compra confirmada: {evento.nome}",
                f"Olá, {participante}! Seu pedido #{pedido.id} foi confirmado. Ingressos: {codigos}.",
                evento_id,
            )
            pedido.notificacao_enviada = True
        except Exception as e:  # noqa: BLE001 - qualquer falha do aviso não afeta a compra
            log.warning("Confirmação do pedido %s não enviada: %s", pedido.id, e)
            pedido.notificacao_enviada = False
        self.db.commit()
        return pedido
