from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .estados import ESTADOS, EstadoPedido


class Pedido(Base):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evento_id: Mapped[int] = mapped_column(Integer, index=True)
    participante: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), index=True)
    quantidade: Mapped[int] = mapped_column(Integer)
    valor_total: Mapped[float] = mapped_column(Float, default=0)
    estado: Mapped[str] = mapped_column(String(10), default="CRIADO")
    meio: Mapped[str] = mapped_column(String(10))
    final_cartao: Mapped[str | None] = mapped_column(String(4), nullable=True)
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pagamento_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notificacao_enviada: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    ingressos: Mapped[list["Ingresso"]] = relationship(back_populates="pedido", order_by="Ingresso.codigo")

    # ---------- State ----------

    @property
    def estado_atual(self) -> EstadoPedido:
        return ESTADOS[self.estado]()

    def mudar_estado(self, novo: EstadoPedido) -> None:
        self.estado = novo.nome

    def reservar(self) -> None:
        self.estado_atual.reservar(self)

    def pagar(self) -> None:
        self.estado_atual.pagar(self)

    def concluir(self) -> None:
        self.estado_atual.concluir(self)

    def cancelar(self, motivo: str) -> None:
        self.estado_atual.cancelar(self, motivo)


class Ingresso(Base):
    __tablename__ = "ingressos"

    codigo: Mapped[str] = mapped_column(String(40), primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id"), index=True)
    evento_id: Mapped[int] = mapped_column(Integer, index=True)
    estado: Mapped[str] = mapped_column(String(10), default="EMITIDO")  # EMITIDO, UTILIZADO
    utilizado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    pedido: Mapped[Pedido] = relationship(back_populates="ingressos")
