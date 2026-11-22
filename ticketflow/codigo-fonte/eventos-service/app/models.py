from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Evento(Base):
    __tablename__ = "eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(200))
    local: Mapped[str] = mapped_column(String(200))
    data: Mapped[datetime] = mapped_column(DateTime)
    preco: Mapped[float] = mapped_column(Float)
    capacidade: Mapped[int] = mapped_column(Integer)
    vagas_disponiveis: Mapped[int] = mapped_column(Integer)


class Reserva(Base):
    """Vagas reservadas por um pedido do Serviço de Ingressos (referência só por id)."""

    __tablename__ = "reservas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pedido_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    evento_id: Mapped[int] = mapped_column(ForeignKey("eventos.id"), index=True)
    quantidade: Mapped[int] = mapped_column(Integer)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)
