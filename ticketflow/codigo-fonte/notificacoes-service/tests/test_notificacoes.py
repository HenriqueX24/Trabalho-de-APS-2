from app.canais import EmailCanal, SmsCanal


def test_canais():
    assert EmailCanal().enviar("ana@exemplo.com", "a", "b")
    assert not EmailCanal().enviar("sem-arroba", "a", "b")
    assert SmsCanal().enviar("(21) 99999-0000", "a", "b")
    assert not SmsCanal().enviar("123", "a", "b")


def test_enviar_e_historico(client):
    r = client.post("/notificacoes", json={"destinatario": "ana@exemplo.com", "assunto": "Oi", "mensagem": "Teste"})
    assert r.status_code == 201
    assert r.json()["status"] == "ENVIADA"
    h = client.get("/notificacoes", params={"destinatario": "ana@exemplo.com"}).json()
    assert len(h) == 1 and h[0]["canal"] == "EMAIL"


def test_sms(client):
    r = client.post("/notificacoes", json={"destinatario": "21999990000", "canal": "SMS", "assunto": "Oi", "mensagem": "x"})
    assert r.json()["status"] == "ENVIADA"


def test_broadcast_para_compradores_do_evento(client):
    for email in ["ana@exemplo.com", "bruno@exemplo.com", "ana@exemplo.com"]:
        client.post("/notificacoes", json={"destinatario": email, "assunto": "Compra", "mensagem": "ok", "evento_id": 3})
    client.post("/notificacoes", json={"destinatario": "carla@exemplo.com", "assunto": "Compra", "mensagem": "ok", "evento_id": 4})

    r = client.post("/notificacoes/eventos/3/broadcast", json={"assunto": "Mudou", "mensagem": "Novo local"})
    assert r.status_code == 200
    assert r.json() == {"evento_id": 3, "enviadas": 2, "falhas": 0}

    avisos = client.get("/notificacoes", params={"evento_id": 3}).json()
    assert sum(1 for n in avisos if n["assunto"] == "Mudou") == 2


def test_broadcast_sem_compradores(client):
    r = client.post("/notificacoes/eventos/99/broadcast", json={"assunto": "x", "mensagem": "y"})
    assert r.json()["enviadas"] == 0
