from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Um pagamento por pedido (preocupação C06).
    pedido_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    valor: Mapped[float] = mapped_column(Float)
    meio: Mapped[str] = mapped_column(String(10))
    # PENDENTE, APROVADO, RECUSADO, ESTORNADO
    status: Mapped[str] = mapped_column(String(10), default="PENDENTE")
    # Só os 4 últimos dígitos do cartão são guardados (C06).
    final_cartao: Mapped[str | None] = mapped_column(String(4), nullable=True)
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
