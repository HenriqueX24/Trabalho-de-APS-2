from app import main
from app.observers import EventoListener

EVENTO = {"nome": "Festival", "local": "Praça XV", "data": "2026-12-12T19:00:00", "preco": 80, "capacidade": 3}


class OuvinteFalso(EventoListener):
    def __init__(self):
        self.chamadas = []

    def evento_alterado(self, evento, alteracoes):
        self.chamadas.append((evento.id, alteracoes))


class OuvinteQueFalha(EventoListener):
    def evento_alterado(self, evento, alteracoes):
        raise RuntimeError("não deveria quebrar o PUT")


def test_cadastrar_listar_consultar(client):
    r = client.post("/eventos", json=EVENTO)
    assert r.status_code == 201
    ev = r.json()
    assert ev["vagas_disponiveis"] == 3
    assert client.get("/eventos").json()[0]["nome"] == "Festival"
    assert client.get(f"/eventos/{ev['id']}").status_code == 200
    assert client.get("/eventos/999").status_code == 404


def test_validacao(client):
    assert client.post("/eventos", json={**EVENTO, "capacidade": 0}).status_code == 422
    assert client.post("/eventos", json={**EVENTO, "preco": -1}).status_code == 422


def test_atualizar_avisa_ouvintes(client, monkeypatch):
    ouvinte = OuvinteFalso()
    monkeypatch.setattr(main, "OUVINTES", [ouvinte])
    ev = client.post("/eventos", json=EVENTO).json()

    r = client.put(f"/eventos/{ev['id']}", json={"local": "Teatro Municipal"})
    assert r.status_code == 200
    assert r.json()["local"] == "Teatro Municipal"
    assert ouvinte.chamadas == [(ev["id"], {"local": "Teatro Municipal"})]

    # Sem mudança real, ninguém é avisado.
    client.put(f"/eventos/{ev['id']}", json={"local": "Teatro Municipal"})
    assert len(ouvinte.chamadas) == 1


def test_notificacoes_fora_do_ar_nao_afeta_alteracao(client, monkeypatch):
    # O NotificacaoListener real aponta para um serviço que não existe: só registra a falha.
    monkeypatch.setattr(main, "OUVINTES", [main.NotificacaoListener("http://127.0.0.1:9", timeout=0.5)])
    ev = client.post("/eventos", json=EVENTO).json()
    r = client.put(f"/eventos/{ev['id']}", json={"preco": 90})
    assert r.status_code == 200
    assert client.get(f"/eventos/{ev['id']}").json()["preco"] == 90


def test_reserva_e_sem_vagas(client):
    ev = client.post("/eventos", json=EVENTO).json()
    url = f"/eventos/{ev['id']}/reservas"

    assert client.post(url, json={"pedido_id": 1, "quantidade": 2}).status_code == 201
    # Repetir o mesmo pedido não reserva de novo.
    assert client.post(url, json={"pedido_id": 1, "quantidade": 2}).status_code == 200
    assert client.get(f"/eventos/{ev['id']}").json()["vagas_disponiveis"] == 1

    r = client.post(url, json={"pedido_id": 2, "quantidade": 2})
    assert r.status_code == 409
    assert r.json()["detail"]["vagas_disponiveis"] == 1

    assert client.post(url, json={"pedido_id": 3, "quantidade": 1}).status_code == 201
    assert client.get(f"/eventos/{ev['id']}").json()["vagas_disponiveis"] == 0


def test_liberar_e_idempotente(client):
    ev = client.post("/eventos", json=EVENTO).json()
    client.post(f"/eventos/{ev['id']}/reservas", json={"pedido_id": 7, "quantidade": 3})
    assert client.delete(f"/eventos/{ev['id']}/reservas/7").status_code == 204
    assert client.delete(f"/eventos/{ev['id']}/reservas/7").status_code == 204
    assert client.get(f"/eventos/{ev['id']}").json()["vagas_disponiveis"] == 3


def test_capacidade_nao_menor_que_vendidos(client, monkeypatch):
    monkeypatch.setattr(main, "OUVINTES", [])
    ev = client.post("/eventos", json={**EVENTO, "capacidade": 10}).json()
    client.post(f"/eventos/{ev['id']}/reservas", json={"pedido_id": 1, "quantidade": 4})
    assert client.put(f"/eventos/{ev['id']}", json={"capacidade": 3}).status_code == 409
    r = client.put(f"/eventos/{ev['id']}", json={"capacidade": 20})
    assert r.json()["vagas_disponiveis"] == 16


def test_excluir(client):
    a = client.post("/eventos", json=EVENTO).json()
    b = client.post("/eventos", json=EVENTO).json()
    client.post(f"/eventos/{b['id']}/reservas", json={"pedido_id": 1, "quantidade": 1})
    assert client.delete(f"/eventos/{a['id']}").status_code == 204
    assert client.get(f"/eventos/{a['id']}").status_code == 404
    assert client.delete(f"/eventos/{b['id']}").status_code == 409


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"
