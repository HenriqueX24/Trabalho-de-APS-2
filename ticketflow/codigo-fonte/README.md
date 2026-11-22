# TicketFlow — Código-fonte

Plataforma de gestão de eventos e venda de ingressos em arquitetura de microsserviços.
Python 3.12, FastAPI, SQLAlchemy e SQLite no backend; React + Vite + TypeScript no frontend.
Cada microsserviço roda no seu próprio container Docker, tem seu próprio banco e se comunica com os outros só por REST/JSON.

```
codigo-fonte/
├── docker-compose.yml
├── eventos-service/        (8081)  Observer
├── ingressos-service/      (8082)  State, Adapter
├── pagamento-service/      (8083)  Strategy
├── notificacoes-service/   (8084)  Strategy
└── frontend/               (8080)  React + Vite + TypeScript (ver frontend/README.md)
```

## Como rodar

Requisito: Docker com Docker Compose.

```bash
docker compose up -d --build
```

| Endereço | O quê |
|---|---|
| http://localhost:8080 | Frontend (participante, organizador e portaria) |
| http://localhost:8081/docs | Swagger do Serviço de Eventos |
| http://localhost:8082/docs | Swagger do Serviço de Ingressos |
| http://localhost:8083/docs | Swagger do Serviço de Pagamento |
| http://localhost:8084/docs | Swagger do Serviço de Notificações |

O Serviço de Eventos já sobe com três eventos de exemplo (`SEED_EXEMPLOS=true` no compose).
Para apagar todos os dados e começar do zero:

```bash
docker compose down -v
```

## Demonstração de tolerância a falhas

Pare um container e use o sistema normalmente. Com `restart: unless-stopped`, um container que cai sozinho volta sozinho. Os dados ficam no volume.

| Comando | O que acontece |
|---|---|
| `docker compose stop pagamento-service` | A compra recebe **503**, as vagas são liberadas e o pedido fica CANCELADO. Consultar eventos e validar ingressos continuam funcionando. |
| `docker compose stop notificacoes-service` | A compra termina normalmente (**201**), com `notificacao_enviada: false`. A alteração de evento também é salva (**200**). A falha só vai para o log. |
| `docker compose stop eventos-service` | A compra recebe **503**. A validação de ingressos na portaria continua normal. |
| `docker compose stop ingressos-service` | Compras, pedidos e portaria ficam indisponíveis. Consultar, cadastrar e alterar eventos continuam funcionando. |
| Cartão com final `0000` | Pagamento recusado (**402**), vagas liberadas e pedido CANCELADO. |
| Quantidade maior que as vagas | **409**, sem cobrança. |

Para religar: `docker compose start <serviço>`. No frontend, o botão **Status dos serviços** mostra quem está no ar (`GET /health`).
Para ver os logs dos envios simulados e da auditoria: `docker compose logs -f notificacoes-service eventos-service`.

## Padrões de projeto

| Serviço | Padrão | Onde está |
|---|---|---|
| Eventos | **Observer** | `eventos-service/app/observers.py`: `EventoListener`, `NotificacaoListener` e `AuditoriaListener`. O `EventoService` (`service.py`) avisa os ouvintes depois de salvar a alteração. |
| Ingressos | **State** | `ingressos-service/app/estados.py`: `Criado`, `Reservado`, `Pago`, `Concluido` e `Cancelado`. Cada um só permite as transições válidas. |
| Ingressos | **Adapter** | `ingressos-service/app/gateways.py`: as interfaces `EventosGateway`, `PagamentoGateway` e `NotificacaoGateway`, e os adaptadores `*HttpAdapter`. A base `HttpAdapter` define o timeout de 2 s e o erro `ServicoIndisponivel`. |
| Pagamento | **Strategy** | `pagamento-service/app/strategies.py`: `MeioPagamento`, com `CartaoStrategy`, `PixStrategy` e `BoletoStrategy`. |
| Notificações | **Strategy** | `notificacoes-service/app/canais.py`: `CanalEnvio`, com `EmailCanal` e `SmsCanal`. |

O fluxo de compra, com as compensações, está em `ingressos-service/app/compra.py`.

## APIs REST (JSON)

| Serviço | Método e rota | Descrição |
|---|---|---|
| Eventos | `POST /eventos` · `GET /eventos` · `GET /eventos/{id}` · `PUT /eventos/{id}` · `DELETE /eventos/{id}` | Cadastrar, listar, consultar, atualizar (avisa os ouvintes) e excluir. Só é possível excluir eventos sem ingressos vendidos; caso contrário, 409. |
| Eventos | `POST /eventos/{id}/reservas` · `DELETE /eventos/{id}/reservas/{pedido_id}` | Reservar vagas (atômico; 409 sem vagas; idempotente por pedido) e liberar vagas. |
| Ingressos | `POST /pedidos` · `GET /pedidos/{id}` · `GET /pedidos?email=` | Comprar (201, 402, 404, 409 ou 503), consultar pedido e listar pedidos do participante. |
| Ingressos | `GET /ingressos?email=` ou `?evento_id=` · `GET /ingressos/{codigo}` | Ingressos do participante ou do evento; consultar um ingresso. |
| Ingressos | `POST /ingressos/validar` | Validar e marcar como utilizado: 200, 404 ou 409. |
| Pagamento | `POST /pagamentos` · `GET /pagamentos/{id}` · `POST /pagamentos/{id}/estorno` | Cobrar (status `APROVADO` ou `RECUSADO`; um pagamento por pedido), consultar e estornar. |
| Notificações | `POST /notificacoes` · `POST /notificacoes/eventos/{id}/broadcast` · `GET /notificacoes?destinatario=` | Enviar, avisar os compradores de um evento e consultar o histórico. |
| Todos | `GET /health` | Saber se o serviço está no ar. |

Exemplo de compra:

```bash
curl -X POST localhost:8082/pedidos -H 'Content-Type: application/json' \
  -d '{"evento_id":3,"participante":"Ana Souza","email":"ana@exemplo.com","quantidade":2,"meio":"CARTAO","final_cartao":"4242"}'
```

Nas falhas da compra, `detail` traz `mensagem` e o `pedido` cancelado (no 409, também `vagas_disponiveis`).
Códigos de ingresso: `TF-<evento>-<pedido>-<n>`.

## Testes

Cada serviço tem testes próprios. Os de Ingressos usam adaptadores falsos, sem rede.

```bash
cd eventos-service   # ou ingressos-service, pagamento-service, notificacoes-service
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest
```

## Rodar um serviço sem Docker

```bash
cd eventos-service
pip install -r requirements.txt
SEED_EXEMPLOS=true uvicorn app.main:app --port 8081
```

Variáveis de ambiente:
- `DATABASE_URL`: padrão `sqlite:///./data/<serviço>.db`.
- `EVENTOS_URL`, `PAGAMENTO_URL` e `NOTIFICACOES_URL`: padrão `http://localhost:<porta>`.
- `TIMEOUT_SERVICOS`: padrão `2`.
