"""Serviço de Ingressos (porta 8082): pedidos e compra, emissão, consulta e validação de ingressos."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .compra import CompraFalhou, CompraService
from .database import Base, engine, get_db
from .gateways import gateways_padrao
from .models import Ingresso, Pedido

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="TicketFlow · Serviço de Ingressos", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- schemas ----------


class PedidoEntrada(BaseModel):
    evento_id: int
    participante: str = Field(min_length=1, max_length=200)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=200)
    quantidade: int = Field(ge=1, le=10)
    meio: Literal["CARTAO", "PIX", "BOLETO"]
    final_cartao: str | None = Field(default=None, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def cartao_exige_final(self):
        if self.meio == "CARTAO" and not self.final_cartao:
            raise ValueError("Informe os 4 últimos dígitos do cartão.")
        return self


class PedidoSaida(BaseModel):
    id: int
    evento_id: int
    participante: str
    email: str
    quantidade: int
    valor_total: float
    estado: str
    meio: str
    final_cartao: str | None
    motivo: str | None
    pagamento_id: int | None
    notificacao_enviada: bool | None
    criado_em: datetime | None
    ingressos: list[str]


class IngressoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo: str
    pedido_id: int
    evento_id: int
    estado: str
    participante: str
    email: str
    utilizado_em: datetime | None


class ValidacaoEntrada(BaseModel):
    codigo: str = Field(min_length=1, max_length=40)


def pedido_saida(p: Pedido) -> dict:
    return PedidoSaida(
        id=p.id,
        evento_id=p.evento_id,
        participante=p.participante,
        email=p.email,
        quantidade=p.quantidade,
        valor_total=p.valor_total,
        estado=p.estado,
        meio=p.meio,
        final_cartao=p.final_cartao,
        motivo=p.motivo,
        pagamento_id=p.pagamento_id,
        notificacao_enviada=p.notificacao_enviada,
        criado_em=p.criado_em,
        ingressos=[i.codigo for i in p.ingressos],
    ).model_dump(mode="json")


def ingresso_saida(i: Ingresso) -> dict:
    return IngressoSaida(
        codigo=i.codigo,
        pedido_id=i.pedido_id,
        evento_id=i.evento_id,
        estado=i.estado,
        participante=i.pedido.participante,
        email=i.pedido.email,
        utilizado_em=i.utilizado_em,
    ).model_dump(mode="json")


# ---------- dependências ----------


def get_gateways():
    """Substituível nos testes por adaptadores falsos."""
    return gateways_padrao()


def get_compra(db: Session = Depends(get_db), gws=Depends(get_gateways)) -> CompraService:
    eventos, pagamento, notificacao = gws
    return CompraService(db, eventos, pagamento, notificacao)


# ---------- rotas ----------


@app.get("/health")
def health():
    return {"status": "ok", "servico": "ingressos"}


@app.post("/pedidos", response_model=PedidoSaida, status_code=status.HTTP_201_CREATED)
def comprar(dados: PedidoEntrada, svc: CompraService = Depends(get_compra)):
    try:
        pedido = svc.comprar(
            dados.evento_id,
            dados.participante.strip(),
            dados.email.strip().lower(),
            dados.quantidade,
            dados.meio,
            dados.final_cartao,
        )
    except CompraFalhou as e:
        raise HTTPException(e.status, {"mensagem": e.mensagem, "pedido": pedido_saida(e.pedido), **e.extra})
    return pedido_saida(pedido)


@app.get("/pedidos", response_model=list[PedidoSaida])
def pedidos_por_email(email: str = Query(min_length=3), db: Session = Depends(get_db)):
    pedidos = db.scalars(select(Pedido).where(Pedido.email == email.strip().lower()).order_by(Pedido.id.desc()))
    return [pedido_saida(p) for p in pedidos]


@app.get("/pedidos/{pedido_id}", response_model=PedidoSaida)
def consultar_pedido(pedido_id: int, db: Session = Depends(get_db)):
    p = db.get(Pedido, pedido_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido não encontrado.")
    return pedido_saida(p)


@app.get("/ingressos", response_model=list[IngressoSaida])
def listar_ingressos(email: str | None = None, evento_id: int | None = None, db: Session = Depends(get_db)):
    if email is None and evento_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Informe email ou evento_id.")
    q = select(Ingresso).join(Ingresso.pedido)
    if email is not None:
        q = q.where(Pedido.email == email.strip().lower())
    if evento_id is not None:
        q = q.where(Ingresso.evento_id == evento_id)
    return [ingresso_saida(i) for i in db.scalars(q.order_by(Ingresso.pedido_id, Ingresso.codigo))]


@app.get("/ingressos/{codigo}", response_model=IngressoSaida)
def consultar_ingresso(codigo: str, db: Session = Depends(get_db)):
    i = db.get(Ingresso, codigo.strip().upper())
    if i is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ingresso não encontrado.")
    return ingresso_saida(i)


@app.post("/ingressos/validar", response_model=IngressoSaida)
def validar(dados: ValidacaoEntrada, db: Session = Depends(get_db)):
    """Marca como UTILIZADO. 200 entrada liberada; 409 já utilizado; 404 não existe."""
    codigo = dados.codigo.strip().upper()
    # Atualização atômica: dois leitores do mesmo código ao mesmo tempo -> só um recebe 200.
    r = db.execute(
        update(Ingresso)
        .where(Ingresso.codigo == codigo, Ingresso.estado == "EMITIDO")
        .values(estado="UTILIZADO", utilizado_em=datetime.now())
    )
    db.commit()
    i = db.get(Ingresso, codigo)
    if i is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ingresso não encontrado.")
    db.refresh(i)
    if r.rowcount == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, {"mensagem": "Ingresso já utilizado.", **ingresso_saida(i)})
    return ingresso_saida(i)
