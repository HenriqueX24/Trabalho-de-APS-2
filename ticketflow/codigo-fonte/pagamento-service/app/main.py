"""Serviço de Pagamento (porta 8083): cobrança e estorno por cartão, PIX ou boleto (simulados)."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .service import OperacaoInvalida, PagamentoNaoEncontrado, PagamentoService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("pagamento")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="TicketFlow · Serviço de Pagamento", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class PagamentoEntrada(BaseModel):
    pedido_id: int
    valor: float = Field(ge=0)
    meio: Literal["CARTAO", "PIX", "BOLETO"]
    final_cartao: str | None = Field(default=None, pattern=r"^\d{4}$")


class PagamentoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pedido_id: int
    valor: float
    meio: str
    status: str
    final_cartao: str | None
    motivo: str | None
    criado_em: datetime | None


def get_service(db: Session = Depends(get_db)) -> PagamentoService:
    return PagamentoService(db)


@app.get("/health")
def health():
    return {"status": "ok", "servico": "pagamento"}


@app.post("/pagamentos", response_model=PagamentoSaida, status_code=status.HTTP_201_CREATED)
def cobrar(dados: PagamentoEntrada, response: Response, svc: PagamentoService = Depends(get_service)):
    """Responde 201 com status APROVADO ou RECUSADO. Repetir para o mesmo pedido devolve o mesmo pagamento (200)."""
    try:
        pagamento, criado = svc.cobrar(dados.pedido_id, dados.valor, dados.meio, dados.final_cartao)
    except OperacaoInvalida as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    log.info("Pagamento %s do pedido %s: %s (%s)", pagamento.id, pagamento.pedido_id, pagamento.status, pagamento.meio)
    if not criado:
        response.status_code = status.HTTP_200_OK
    return pagamento


@app.get("/pagamentos/{pagamento_id}", response_model=PagamentoSaida)
def consultar(pagamento_id: int, svc: PagamentoService = Depends(get_service)):
    try:
        return svc.obter(pagamento_id)
    except PagamentoNaoEncontrado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pagamento não encontrado.")


@app.post("/pagamentos/{pagamento_id}/estorno", response_model=PagamentoSaida)
def estornar(pagamento_id: int, svc: PagamentoService = Depends(get_service)):
    try:
        return svc.estornar(pagamento_id)
    except PagamentoNaoEncontrado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pagamento não encontrado.")
    except OperacaoInvalida as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
