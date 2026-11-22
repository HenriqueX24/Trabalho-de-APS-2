from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Notificacao(Base):
    __tablename__ = "notificacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    destinatario: Mapped[str] = mapped_column(String(200), index=True)
    canal: Mapped[str] = mapped_column(String(10))  # EMAIL, SMS
    assunto: Mapped[str] = mapped_column(String(200))
    mensagem: Mapped[str] = mapped_column(Text)
    evento_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(10))  # ENVIADA, FALHA
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DestinatarioEvento(Base):
    """Compradores de um evento, usados no aviso em massa quando o evento muda."""

    __tablename__ = "destinatarios_evento"
    __table_args__ = (UniqueConstraint("evento_id", "destinatario", name="uq_evento_destinatario"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evento_id: Mapped[int] = mapped_column(Integer, index=True)
    destinatario: Mapped[str] = mapped_column(String(200))
    canal: Mapped[str] = mapped_column(String(10), default="EMAIL")
