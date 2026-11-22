from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Pagamento
from .strategies import ESTRATEGIAS, MeioPagamento


class PagamentoNaoEncontrado(Exception):
    pass


class OperacaoInvalida(Exception):
    pass


class PagamentoService:
    def __init__(self, db: Session, estrategias: dict[str, MeioPagamento] | None = None):
        self.db = db
        self.estrategias = estrategias or ESTRATEGIAS

    def cobrar(self, pedido_id: int, valor: float, meio: str, final_cartao: str | None) -> tuple[Pagamento, bool]:
        """Cobra um pedido. Devolve (pagamento, criado_agora). Idempotente por pedido."""
        existente = self.db.scalar(select(Pagamento).where(Pagamento.pedido_id == pedido_id))
        if existente is not None:
            return existente, False

        estrategia = self.estrategias.get(meio)
        if estrategia is None:
            raise OperacaoInvalida(f"Meio de pagamento não suportado: {meio}.")

        final = final_cartao if meio == "CARTAO" else None
        pagamento = Pagamento(pedido_id=pedido_id, valor=valor, meio=meio, final_cartao=final, status="PENDENTE")
        # O serviço chama a interface; não sabe qual classe executa.
        autorizacao = estrategia.autorizar(valor, final)
        pagamento.status = "APROVADO" if autorizacao.aprovado else "RECUSADO"
        pagamento.motivo = autorizacao.motivo
        self.db.add(pagamento)
        self.db.commit()
        return pagamento, True

    def obter(self, pagamento_id: int) -> Pagamento:
        p = self.db.get(Pagamento, pagamento_id)
        if p is None:
            raise PagamentoNaoEncontrado()
        return p

    def estornar(self, pagamento_id: int) -> Pagamento:
        p = self.obter(pagamento_id)
        if p.status != "APROVADO":
            raise OperacaoInvalida(f"Só pagamentos aprovados podem ser estornados (status atual: {p.status}).")
        p.status = "ESTORNADO"
        self.db.commit()
        return p
