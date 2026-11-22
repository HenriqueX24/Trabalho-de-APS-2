# TicketFlow — Frontend

Interface web do TicketFlow (React 19 + Vite + TypeScript + React Router), feita a partir dos protótipos de telas.

## Telas

| Perfil | Rota | Tela | Chamadas |
|---|---|---|---|
| — | `/` | Escolha do perfil | — |
| Participante | `/eventos` | Eventos disponíveis (busca, vagas, esgotado) | `GET /eventos` |
| Participante | `/eventos/:id/comprar` | Comprar ingresso + resultado (201 / 402 / 409 / 503) | `GET /eventos/{id}`, `POST /pedidos` |
| Participante | `/meus-pedidos` | Meus pedidos e ingressos | `GET /pedidos?email=`, `GET /ingressos?email=` |
| Organizador | `/organizador/eventos` | Cadastrar, atualizar (avisa compradores) e excluir evento | `POST /eventos`, `PUT /eventos/{id}`, `DELETE /eventos/{id}` |
| Organizador | `/organizador/vendidos` | Ingressos vendidos por evento | `GET /ingressos?evento_id=` |
| Portaria | `/portaria` | Validar (200 / 404 / 409) e consultar ingresso | `POST /ingressos/validar`, `GET /ingressos/{codigo}` |

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

### Dois modos de API

- **Simulado (padrão):** um backend em memória no navegador, com as regras da Descrição do Sistema: reserva de vagas, compensação, estados do pedido, cartão final `0000` recusado, timeout de 2 s e falha de notificação apenas registrada. Ele permite demonstrar o frontend antes dos serviços existirem. No botão **Simular falhas** (canto inferior direito) dá para derrubar cada serviço, como se o container tivesse caído, e restaurar os dados iniciais.
- **HTTP (serviços reais):** `VITE_API_MODE=http npm run dev`. O Vite repassa `/svc/eventos`, `/svc/ingressos`, `/svc/pagamento` e `/svc/notificacoes` para `localhost:8081` a `8084`, sem precisar de CORS. Para outro host, use `EVENTOS_TARGET=http://host:8081` etc. Nesse modo o botão vira **Status dos serviços** (`GET /health`).

### Docker

O frontend já está no `docker-compose.yml` de `codigo-fonte/`. A imagem gera o build no modo HTTP e serve com nginx na porta 8080, repassando `/svc/<serviço>` para os containers na rede `ticketflow-net`.

## Contrato com os serviços

O contrato completo das APIs está no `README.md` de `codigo-fonte/`. Resumo do que o frontend usa:

- **Erros** no formato do FastAPI: `{"detail": "mensagem"}` ou `{"detail": {"mensagem": ..., ...}}`. Falha de rede, 502 e 504 são tratados como 503.
- **`POST /pedidos`** devolve 201 com o pedido e a lista `ingressos`. Nos casos 402, 409 e 503, `detail` traz `mensagem` e o `pedido` cancelado (no 409, também `vagas_disponiveis`).
- **`GET /pedidos?email=`** lista os pedidos do participante, inclusive os cancelados (tela "Meus pedidos").
- **`DELETE /eventos/{id}`** exclui evento sem ingressos vendidos. Com ingressos vendidos, responde 409.
- **Ingressos** vêm com `participante` e `email` (tela de vendidos e portaria).

## Estrutura

```
src/
├── api/          types.ts (contrato), http.ts (serviços reais), mock.ts (simulado), index.ts
├── components/   Layout, PainelServicos, ResultadoCompra, Estado, Aviso
├── pages/        Inicio, Eventos, Comprar, MeusPedidos, OrgEventos, OrgVendidos, Portaria
└── lib/          formato, perfil (participante no localStorage), useCarga
```
