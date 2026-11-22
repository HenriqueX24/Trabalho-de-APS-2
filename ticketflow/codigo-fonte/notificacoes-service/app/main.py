"""Serviço de Notificações (porta 8084): envio por e-mail e SMS (simulados) e aviso aos compradores."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .service import CanalInvalido, NotificacaoService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="TicketFlow · Serviço de Notificações", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class NotificacaoEntrada(BaseModel):
    destinatario: str = Field(min_length=3, max_length=200)
    canal: Literal["EMAIL", "SMS"] = "EMAIL"
    assunto: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1)
    evento_id: int | None = None


class BroadcastEntrada(BaseModel):
    assunto: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1)


class NotificacaoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    destinatario: str
    canal: str
    assunto: str
    mensagem: str
    evento_id: int | None
    status: str
    criado_em: datetime | None


class BroadcastSaida(BaseModel):
    evento_id: int
    enviadas: int
    falhas: int


def get_service(db: Session = Depends(get_db)) -> NotificacaoService:
    return NotificacaoService(db)


@app.get("/health")
def health():
    return {"status": "ok", "servico": "notificacoes"}


@app.post("/notificacoes", response_model=NotificacaoSaida, status_code=status.HTTP_201_CREATED)
def enviar(dados: NotificacaoEntrada, svc: NotificacaoService = Depends(get_service)):
    try:
        return svc.enviar(dados.destinatario.strip(), dados.canal, dados.assunto, dados.mensagem, dados.evento_id)
    except CanalInvalido as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))


@app.post("/notificacoes/eventos/{evento_id}/broadcast", response_model=BroadcastSaida)
def broadcast(evento_id: int, dados: BroadcastEntrada, svc: NotificacaoService = Depends(get_service)):
    enviadas = svc.broadcast(evento_id, dados.assunto, dados.mensagem)
    ok = sum(1 for n in enviadas if n.status == "ENVIADA")
    return BroadcastSaida(evento_id=evento_id, enviadas=ok, falhas=len(enviadas) - ok)


@app.get("/notificacoes", response_model=list[NotificacaoSaida])
def historico(destinatario: str | None = None, evento_id: int | None = None, svc: NotificacaoService = Depends(get_service)):
    return svc.historico(destinatario, evento_id)
