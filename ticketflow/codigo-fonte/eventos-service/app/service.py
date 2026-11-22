"""Regras do Serviço de Eventos: cadastro, alteração (com Observer) e controle de vagas."""
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .models import Evento, Reserva
from .observers import EventoListener
from .schemas import EventoAtualizacao, EventoEntrada


class EventoNaoEncontrado(Exception):
    pass


class SemVagas(Exception):
    def __init__(self, vagas_disponiveis: int):
        super().__init__("Não há vagas suficientes.")
        self.vagas_disponiveis = vagas_disponiveis


class OperacaoInvalida(Exception):
    pass


class EventoService:
    def __init__(self, db: Session, ouvintes: list[EventoListener] | None = None):
        self.db = db
        self.ouvintes: list[EventoListener] = list(ouvintes or [])

    # ---------- Observer ----------

    def adicionar_ouvinte(self, ouvinte: EventoListener) -> None:
        self.ouvintes.append(ouvinte)

    def _avisar(self, evento: Evento, alteracoes: dict) -> None:
        for ouvinte in self.ouvintes:
            ouvinte.evento_alterado(evento, alteracoes)

    # ---------- eventos ----------

    def listar(self) -> list[Evento]:
        return list(self.db.scalars(select(Evento).order_by(Evento.data)))

    def obter(self, evento_id: int) -> Evento:
        evento = self.db.get(Evento, evento_id)
        if evento is None:
            raise EventoNaoEncontrado()
        return evento

    def cadastrar(self, dados: EventoEntrada) -> Evento:
        evento = Evento(**dados.model_dump(), vagas_disponiveis=dados.capacidade)
        self.db.add(evento)
        self.db.commit()
        return evento

    def atualizar(self, evento_id: int, dados: EventoAtualizacao) -> Evento:
        evento = self.obter(evento_id)
        novos = dados.model_dump(exclude_unset=True, exclude_none=True)
        alteracoes = {c: v for c, v in novos.items() if getattr(evento, c) != v}

        if "capacidade" in alteracoes:
            vendidos = evento.capacidade - evento.vagas_disponiveis
            if alteracoes["capacidade"] < vendidos:
                raise OperacaoInvalida(f"A capacidade não pode ser menor que os {vendidos} ingressos já vendidos.")
            evento.vagas_disponiveis = alteracoes["capacidade"] - vendidos

        for campo, valor in alteracoes.items():
            setattr(evento, campo, valor)
        self.db.commit()

        # Avisa os ouvintes só depois de salvar; falha de um ouvinte não desfaz a alteração.
        if alteracoes:
            self._avisar(evento, alteracoes)
        return evento

    def excluir(self, evento_id: int) -> None:
        evento = self.obter(evento_id)
        ativas = self.db.scalar(select(Reserva).where(Reserva.evento_id == evento_id, Reserva.ativa).limit(1))
        if ativas is not None:
            raise OperacaoInvalida("O evento tem ingressos vendidos e não pode ser excluído.")
        self.db.query(Reserva).filter(Reserva.evento_id == evento_id).delete()
        self.db.delete(evento)
        self.db.commit()

    # ---------- vagas ----------

    def reservar(self, evento_id: int, pedido_id: int, quantidade: int) -> tuple[Reserva, bool]:
        """Reserva vagas com uma atualização atômica. Devolve (reserva, criada_agora).

        Idempotente por pedido: repetir a chamada com o mesmo pedido_id não reserva de novo.
        """
        self.obter(evento_id)
        existente = self.db.scalar(select(Reserva).where(Reserva.pedido_id == pedido_id))
        if existente is not None:
            if existente.ativa and existente.evento_id == evento_id:
                return existente, False
            raise OperacaoInvalida("Este pedido já teve uma reserva.")

        # UPDATE ... WHERE vagas_disponiveis >= quantidade: se duas compras disputam
        # a última vaga, só uma consegue; a outra recebe 409.
        resultado = self.db.execute(
            update(Evento)
            .where(Evento.id == evento_id, Evento.vagas_disponiveis >= quantidade)
            .values(vagas_disponiveis=Evento.vagas_disponiveis - quantidade)
        )
        if resultado.rowcount == 0:
            self.db.rollback()
            raise SemVagas(self.obter(evento_id).vagas_disponiveis)

        reserva = Reserva(pedido_id=pedido_id, evento_id=evento_id, quantidade=quantidade, ativa=True)
        self.db.add(reserva)
        self.db.commit()
        return reserva, True

    def liberar(self, evento_id: int, pedido_id: int) -> bool:
        """Libera as vagas de um pedido (compensação). Idempotente."""
        reserva = self.db.scalar(
            select(Reserva).where(Reserva.pedido_id == pedido_id, Reserva.evento_id == evento_id)
        )
        if reserva is None or not reserva.ativa:
            return False
        reserva.ativa = False
        self.db.execute(
            update(Evento)
            .where(Evento.id == evento_id)
            .values(vagas_disponiveis=Evento.vagas_disponiveis + reserva.quantidade)
        )
        self.db.commit()
        return True
