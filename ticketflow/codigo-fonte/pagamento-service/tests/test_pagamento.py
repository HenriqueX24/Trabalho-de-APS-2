from app.strategies import BoletoStrategy, CartaoStrategy, PixStrategy


def test_estrategias():
    assert CartaoStrategy().autorizar(10, "4242").aprovado
    assert not CartaoStrategy().autorizar(10, "0000").aprovado
    assert not CartaoStrategy().autorizar(10, None).aprovado
    assert PixStrategy().autorizar(10).aprovado
    assert BoletoStrategy().autorizar(10).aprovado


def test_cartao_aprovado_guarda_so_final(client):
    r = client.post("/pagamentos", json={"pedido_id": 1, "valor": 160, "meio": "CARTAO", "final_cartao": "4242"})
    assert r.status_code == 201
    p = r.json()
    assert p["status"] == "APROVADO"
    assert p["final_cartao"] == "4242"


def test_cartao_0000_recusado(client):
    r = client.post("/pagamentos", json={"pedido_id": 2, "valor": 50, "meio": "CARTAO", "final_cartao": "0000"})
    assert r.status_code == 201
    assert r.json()["status"] == "RECUSADO"


def test_pix_ignora_cartao(client):
    r = client.post("/pagamentos", json={"pedido_id": 3, "valor": 25, "meio": "PIX", "final_cartao": "1234"})
    assert r.json()["status"] == "APROVADO"
    assert r.json()["final_cartao"] is None


def test_um_pagamento_por_pedido(client):
    a = client.post("/pagamentos", json={"pedido_id": 4, "valor": 25, "meio": "PIX"})
    b = client.post("/pagamentos", json={"pedido_id": 4, "valor": 25, "meio": "PIX"})
    assert a.status_code == 201 and b.status_code == 200
    assert a.json()["id"] == b.json()["id"]


def test_meio_invalido(client):
    assert client.post("/pagamentos", json={"pedido_id": 5, "valor": 1, "meio": "CHEQUE"}).status_code == 422


def test_consultar_e_estornar(client):
    p = client.post("/pagamentos", json={"pedido_id": 6, "valor": 80, "meio": "BOLETO"}).json()
    assert client.get(f"/pagamentos/{p['id']}").json()["status"] == "APROVADO"
    r = client.post(f"/pagamentos/{p['id']}/estorno")
    assert r.json()["status"] == "ESTORNADO"
    assert client.post(f"/pagamentos/{p['id']}/estorno").status_code == 409
    assert client.get("/pagamentos/999").status_code == 404
