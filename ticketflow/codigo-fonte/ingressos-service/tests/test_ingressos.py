"""Testes da compra com adaptadores falsos (a vantagem do Adapter: sem rede)."""
import pytest

from app.estados import TransicaoInvalida
from app.gateways import (
    EventoInfo,
    EventoNaoEncontrado,
    EventosGateway,
    NotificacaoGateway,
    PagamentoGateway,
    ResultadoPagamento,
    SemVagas,
    ServicoIndisponivel,
)
from app.main import app, get_gateways
from app.models import Pedido


class EventosFalso(EventosGateway):
    def __init__(self, vagas=10, fora=False):
        self.vagas = vagas
        self.fora = fora
        self.reservas: dict[int, int] = {}

    def obter_evento(self, evento_id):
        if self.fora:
            raise ServicoIndisponivel("Eventos")
        if evento_id != 3:
            raise EventoNaoEncontrado()
        return EventoInfo(3, "Festival de Jazz", 80.0, self.vagas)

    def reservar(self, evento_id, pedido_id, quantidade):
        if quantidade > self.vagas:
            raise SemVagas(self.vagas)
        self.vagas -= quantidade
        self.reservas[pedido_id] = quantidade

    def liberar(self, evento_id, pedido_id):
        self.vagas += self.reservas.pop(pedido_id, 0)


class PagamentoFalso(PagamentoGateway):
    def __init__(self, fora=False):
        self.fora = fora

    def cobrar(self, pedido_id, valor, meio, final_cartao):
        if self.fora:
            raise ServicoIndisponivel("Pagamento")
        return ResultadoPagamento(final_cartao != "0000", 100 + pedido_id)


class NotificacaoFalsa(NotificacaoGateway):
    def __init__(self, fora=False):
        self.fora = fora
        self.enviadas = []

    def enviar(self, destinatario, assunto, mensagem, evento_id):
        if self.fora:
            raise ServicoIndisponivel("Notificações")
        self.enviadas.append(destinatario)


@pytest.fixture
def gws():
    g = {"eventos": EventosFalso(), "pagamento": PagamentoFalso(), "notificacao": NotificacaoFalsa()}
    app.dependency_overrides[get_gateways] = lambda: (g["eventos"], g["pagamento"], g["notificacao"])
    return g


PEDIDO = {"evento_id": 3, "participante": "Ana Souza", "email": "Ana@Exemplo.com", "quantidade": 2, "meio": "CARTAO", "final_cartao": "4242"}


def test_compra_concluida(client, gws):
    r = client.post("/pedidos", json=PEDIDO)
    assert r.status_code == 201
    p = r.json()
    assert p["estado"] == "CONCLUIDO"
    assert p["valor_total"] == 160
    assert p["email"] == "ana@exemplo.com"
    assert p["ingressos"] == [f"TF-3-{p['id']}-1", f"TF-3-{p['id']}-2"]
    assert p["notificacao_enviada"] is True
    assert gws["eventos"].vagas == 8
    assert gws["notificacao"].enviadas == ["ana@exemplo.com"]


def test_pagamento_recusado_libera_vagas(client, gws):
    r = client.post("/pedidos", json={**PEDIDO, "final_cartao": "0000"})
    assert r.status_code == 402
    assert r.json()["detail"]["pedido"]["estado"] == "CANCELADO"
    assert gws["eventos"].vagas == 10


def test_sem_vagas(client, gws):
    gws["eventos"].vagas = 1
    r = client.post("/pedidos", json=PEDIDO)
    assert r.status_code == 409
    assert r.json()["detail"]["vagas_disponiveis"] == 1
    assert r.json()["detail"]["pedido"]["estado"] == "CANCELADO"


def test_pagamento_fora_do_ar(client, gws):
    gws["pagamento"].fora = True
    r = client.post("/pedidos", json=PEDIDO)
    assert r.status_code == 503
    assert "Pagamento" in r.json()["detail"]["mensagem"]
    assert gws["eventos"].vagas == 10


def test_eventos_fora_do_ar(client, gws):
    gws["eventos"].fora = True
    r = client.post("/pedidos", json=PEDIDO)
    assert r.status_code == 503
    assert "Eventos" in r.json()["detail"]["mensagem"]


def test_notificacoes_fora_do_ar_nao_afeta_compra(client, gws):
    gws["notificacao"].fora = True
    r = client.post("/pedidos", json=PEDIDO)
    assert r.status_code == 201
    assert r.json()["notificacao_enviada"] is False


def test_evento_inexistente(client, gws):
    assert client.post("/pedidos", json={**PEDIDO, "evento_id": 99}).status_code == 404


def test_validacao_entrada(client, gws):
    assert client.post("/pedidos", json={**PEDIDO, "final_cartao": None}).status_code == 422
    assert client.post("/pedidos", json={**PEDIDO, "email": "x"}).status_code == 422
    assert client.post("/pedidos", json={**PEDIDO, "meio": "PIX", "final_cartao": None}).status_code == 201


def test_consultas(client, gws):
    p = client.post("/pedidos", json=PEDIDO).json()
    client.post("/pedidos", json={**PEDIDO, "final_cartao": "0000"})
    assert client.get(f"/pedidos/{p['id']}").json()["id"] == p["id"]
    assert client.get("/pedidos/999").status_code == 404
    assert len(client.get("/pedidos", params={"email": "ana@exemplo.com"}).json()) == 2

    por_email = client.get("/ingressos", params={"email": "ana@exemplo.com"}).json()
    assert len(por_email) == 2 and por_email[0]["participante"] == "Ana Souza"
    assert len(client.get("/ingressos", params={"evento_id": 3}).json()) == 2
    assert client.get("/ingressos").status_code == 400
    assert client.get(f"/ingressos/{p['ingressos'][0].lower()}").json()["estado"] == "EMITIDO"


def test_validar_ingresso(client, gws):
    codigo = client.post("/pedidos", json=PEDIDO).json()["ingressos"][0]
    r = client.post("/ingressos/validar", json={"codigo": codigo})
    assert r.status_code == 200 and r.json()["estado"] == "UTILIZADO"
    r = client.post("/ingressos/validar", json={"codigo": codigo})
    assert r.status_code == 409 and r.json()["detail"]["codigo"] == codigo
    assert client.post("/ingressos/validar", json={"codigo": "TF-9-99-9"}).status_code == 404


def test_state_recusa_transicoes_invalidas():
    p = Pedido(estado="CRIADO")
    with pytest.raises(TransicaoInvalida):
        p.pagar()  # não se paga sem reservar
    p.reservar()
    p.pagar()
    with pytest.raises(TransicaoInvalida):
        p.cancelar("x")  # pago não volta a cancelado
    p.concluir()
    assert p.estado == "CONCLUIDO"

    c = Pedido(estado="CANCELADO")
    for acao in (c.reservar, c.pagar, c.concluir):
        with pytest.raises(TransicaoInvalida):
            acao()
