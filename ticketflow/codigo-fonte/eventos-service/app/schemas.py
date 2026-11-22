from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EventoEntrada(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    local: str = Field(min_length=1, max_length=200)
    data: datetime
    preco: float = Field(ge=0)
    capacidade: int = Field(gt=0)


class EventoAtualizacao(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    local: str | None = Field(default=None, min_length=1, max_length=200)
    data: datetime | None = None
    preco: float | None = Field(default=None, ge=0)
    capacidade: int | None = Field(default=None, gt=0)


class EventoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    local: str
    data: datetime
    preco: float
    capacidade: int
    vagas_disponiveis: int


class ReservaEntrada(BaseModel):
    pedido_id: int
    quantidade: int = Field(gt=0)


class ReservaSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pedido_id: int
    evento_id: int
    quantidade: int
    ativa: bool
