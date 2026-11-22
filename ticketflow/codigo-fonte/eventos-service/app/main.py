"""Serviço de Eventos (porta 8081): cadastro e consulta de eventos, controle de vagas."""
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db
from .models import Evento
from .observers import AuditoriaListener, NotificacaoListener
from .schemas import EventoAtualizacao, EventoEntrada, EventoSaida, ReservaEntrada, ReservaSaida
from .service import EventoNaoEncontrado, EventoService, OperacaoInvalida, SemVagas

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

EXEMPLOS = [
    dict(nome="Semana de Tecnologia CEFET", local="Campus Maracanã, Rio de Janeiro", data=datetime(2026, 12, 3, 9, 0), preco=25.0, capacidade=200),
    dict(nome="Stand-up na Lapa", local="Teatro da Lapa, Rio de Janeiro", data=datetime(2026, 12, 19, 21, 0), preco=60.0, capacidade=150),
    dict(nome="Festival de Jazz da Praça", local="Praça XV, Rio de Janeiro", data=datetime(2026, 12, 12, 19, 0), preco=80.0, capacidade=400),
]


def semear_exemplos() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Evento)) == 0:
            db.add_all(Evento(**e, vagas_disponiveis=e["capacidade"]) for e in EXEMPLOS)
            db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    if os.getenv("SEED_EXEMPLOS", "false").lower() == "true":
        semear_exemplos()
    yield


app = FastAPI(title="TicketFlow · Serviço de Eventos", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Ouvintes cadastrados (Observer). Novas reações entram aqui sem mudar o EventoService.
OUVINTES = [NotificacaoListener(), AuditoriaListener()]


def get_service(db: Session = Depends(get_db)) -> EventoService:
    return EventoService(db, OUVINTES)


def _404():
    return HTTPException(status.HTTP_404_NOT_FOUND, "Evento não encontrado.")


@app.get("/health")
def health():
    return {"status": "ok", "servico": "eventos"}


@app.post("/eventos", response_model=EventoSaida, status_code=status.HTTP_201_CREATED)
def cadastrar(dados: EventoEntrada, svc: EventoService = Depends(get_service)):
    return svc.cadastrar(dados)


@app.get("/eventos", response_model=list[EventoSaida])
def listar(svc: EventoService = Depends(get_service)):
    return svc.listar()


@app.get("/eventos/{evento_id}", response_model=EventoSaida)
def consultar(evento_id: int, svc: EventoService = Depends(get_service)):
    try:
        return svc.obter(evento_id)
    except EventoNaoEncontrado:
        raise _404()


@app.put("/eventos/{evento_id}", response_model=EventoSaida)
def atualizar(evento_id: int, dados: EventoAtualizacao, svc: EventoService = Depends(get_service)):
    try:
        return svc.atualizar(evento_id, dados)
    except EventoNaoEncontrado:
        raise _404()
    except OperacaoInvalida as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))


@app.delete("/eventos/{evento_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(evento_id: int, svc: EventoService = Depends(get_service)):
    try:
        svc.excluir(evento_id)
    except EventoNaoEncontrado:
        raise _404()
    except OperacaoInvalida as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/eventos/{evento_id}/reservas", response_model=ReservaSaida, status_code=status.HTTP_201_CREATED)
def reservar(evento_id: int, dados: ReservaEntrada, response: Response, svc: EventoService = Depends(get_service)):
    try:
        reserva, criada = svc.reservar(evento_id, dados.pedido_id, dados.quantidade)
    except EventoNaoEncontrado:
        raise _404()
    except SemVagas as e:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"mensagem": "Não há vagas suficientes.", "vagas_disponiveis": e.vagas_disponiveis},
        )
    except OperacaoInvalida as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    if not criada:
        response.status_code = status.HTTP_200_OK
    return reserva


@app.delete("/eventos/{evento_id}/reservas/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT)
def liberar(evento_id: int, pedido_id: int, svc: EventoService = Depends(get_service)):
    svc.liberar(evento_id, pedido_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
