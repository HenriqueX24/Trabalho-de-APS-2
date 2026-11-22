"""Padrão Adapter: a compra usa interfaces próprias; os adaptadores traduzem para REST/JSON.

Todos os adaptadores herdam de HttpAdapter, que define o timeout de 2 s e transforma
qualquer falha de rede (ou 5xx) em um erro único: ServicoIndisponivel.
"""
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

TIMEOUT_S = float(os.getenv("TIMEOUT_SERVICOS", "2"))


# ---------- erros de domínio ----------


class ServicoIndisponivel(Exception):
    def __init__(self, servico: str):
        super().__init__(f"Serviço de {servico} indisponível (sem resposta em até {TIMEOUT_S:g} s).")
        self.servico = servico


class EventoNaoEncontrado(Exception):
    pass


class SemVagas(Exception):
    def __init__(self, vagas_disponiveis: int | None):
        super().__init__("Não há vagas suficientes.")
        self.vagas_disponiveis = vagas_disponiveis


@dataclass
class EventoInfo:
    id: int
    nome: str
    preco: float
    vagas_disponiveis: int


@dataclass
class ResultadoPagamento:
    aprovado: bool
    pagamento_id: int | None
    motivo: str | None = None


# ---------- interfaces usadas pela compra ----------


class EventosGateway(ABC):
    @abstractmethod
    def obter_evento(self, evento_id: int) -> EventoInfo: ...

    @abstractmethod
    def reservar(self, evento_id: int, pedido_id: int, quantidade: int) -> None: ...

    @abstractmethod
    def liberar(self, evento_id: int, pedido_id: int) -> None: ...


class PagamentoGateway(ABC):
    @abstractmethod
    def cobrar(self, pedido_id: int, valor: float, meio: str, final_cartao: str | None) -> ResultadoPagamento: ...


class NotificacaoGateway(ABC):
    @abstractmethod
    def enviar(self, destinatario: str, assunto: str, mensagem: str, evento_id: int | None) -> None: ...


# ---------- adaptadores HTTP ----------


class HttpAdapter:
    servico = ""

    def __init__(self, base_url: str, timeout: float = TIMEOUT_S, client: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = client

    def _req(self, metodo: str, caminho: str, **kw) -> httpx.Response:
        try:
            if self.client is not None:
                r = self.client.request(metodo, self.base_url + caminho, timeout=self.timeout, **kw)
            else:
                r = httpx.request(metodo, self.base_url + caminho, timeout=self.timeout, **kw)
        except httpx.HTTPError as e:
            raise ServicoIndisponivel(self.servico) from e
        if r.status_code >= 500:
            raise ServicoIndisponivel(self.servico)
        return r


class EventosHttpAdapter(HttpAdapter, EventosGateway):
    servico = "Eventos"

    def obter_evento(self, evento_id: int) -> EventoInfo:
        r = self._req("GET", f"/eventos/{evento_id}")
        if r.status_code == 404:
            raise EventoNaoEncontrado()
        r.raise_for_status()
        d = r.json()
        return EventoInfo(id=d["id"], nome=d["nome"], preco=d["preco"], vagas_disponiveis=d["vagas_disponiveis"])

    def reservar(self, evento_id: int, pedido_id: int, quantidade: int) -> None:
        r = self._req("POST", f"/eventos/{evento_id}/reservas", json={"pedido_id": pedido_id, "quantidade": quantidade})
        if r.status_code == 404:
            raise EventoNaoEncontrado()
        if r.status_code == 409:
            detalhe = r.json().get("detail")
            vagas = detalhe.get("vagas_disponiveis") if isinstance(detalhe, dict) else None
            raise SemVagas(vagas)
        r.raise_for_status()

    def liberar(self, evento_id: int, pedido_id: int) -> None:
        self._req("DELETE", f"/eventos/{evento_id}/reservas/{pedido_id}")


class PagamentoHttpAdapter(HttpAdapter, PagamentoGateway):
    servico = "Pagamento"

    def cobrar(self, pedido_id: int, valor: float, meio: str, final_cartao: str | None) -> ResultadoPagamento:
        r = self._req(
            "POST",
            "/pagamentos",
            json={"pedido_id": pedido_id, "valor": valor, "meio": meio, "final_cartao": final_cartao},
        )
        if r.status_code == 422:
            return ResultadoPagamento(False, None, "Dados de pagamento inválidos.")
        r.raise_for_status()
        d = r.json()
        return ResultadoPagamento(d["status"] == "APROVADO", d["id"], d.get("motivo"))


class NotificacaoHttpAdapter(HttpAdapter, NotificacaoGateway):
    servico = "Notificações"

    def enviar(self, destinatario: str, assunto: str, mensagem: str, evento_id: int | None) -> None:
        r = self._req(
            "POST",
            "/notificacoes",
            json={"destinatario": destinatario, "canal": "EMAIL", "assunto": assunto, "mensagem": mensagem, "evento_id": evento_id},
        )
        r.raise_for_status()


def gateways_padrao() -> tuple[EventosGateway, PagamentoGateway, NotificacaoGateway]:
    return (
        EventosHttpAdapter(os.getenv("EVENTOS_URL", "http://localhost:8081")),
        PagamentoHttpAdapter(os.getenv("PAGAMENTO_URL", "http://localhost:8083")),
        NotificacaoHttpAdapter(os.getenv("NOTIFICACOES_URL", "http://localhost:8084")),
    )
