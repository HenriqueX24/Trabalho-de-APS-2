# TicketFlow — Frontend

Interface web do TicketFlow (React 19 + Vite + TypeScript + React Router), feita a partir dos protótipos de telas.

## Telas

| Perfil | Rota | Tela | Chamadas |
|---|---|---|---|
| — | `/` | Escolha do perfil | — |
| Participante | `/eventos` | Eventos disponíveis (busca, vagas, esgotado) | `GET /eventos` |
| Participante | `/eventos/:id/comprar` | Comprar ingresso + resultado (201 / 402 / 409 / 503) | `GET /eventos/{id}`, `POST /pedidos` |
| Participante | `/meus-pedidos` | Meus pedidos e ingressos | `GET /ingressos?email=`, `GET /pedidos/{id}` |
| Organizador | `/organizador/eventos` | Cadastrar / atualizar evento (avisa compradores) | `POST /eventos`, `PUT /eventos/{id}` |
| Organizador | `/organizador/vendidos` | Ingressos vendidos por evento | `GET /ingressos?evento_id=` |
| Portaria | `/portaria` | Validar (200 / 404 / 409) e consultar ingresso | `POST /ingressos/validar`, `GET /ingressos/{codigo}` |

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

### Dois modos de API

- **Simulado (padrão):** um backend em memória no navegador, com as regras da Descrição do Sistema: reserva de vagas, compensação, estados do pedido, cartão final `0000` recusado, timeout de 2 s e falha de notificação apenas registrada. Ele permite demonstrar o frontend antes dos serviços existirem. O botão **Simular falhas** (canto inferior direito) para cada serviço, como se o container tivesse caído, e restaura os dados iniciais.
- **HTTP (serviços reais):** `VITE_API_MODE=http npm run dev`. O Vite repassa `/svc/eventos`, `/svc/ingressos`, `/svc/pagamento` e `/svc/notificacoes` para `localhost:8081` a `8084`, sem precisar de CORS. Para outro host, use `EVENTOS_TARGET=http://host:8081` etc. Nesse modo o botão vira **Status dos serviços** (`GET /health`).

### Docker

```bash
docker build -t ticketflow-frontend .
```

A imagem gera o build no modo HTTP e serve com nginx na porta 8080, repassando `/svc/<serviço>` para os containers na rede `ticketflow-net`. Trecho para o `docker-compose.yml`:

```yaml
  frontend:
    build: ./frontend
    ports: ["8080:8080"]
    restart: unless-stopped
```

## Contrato esperado dos serviços

O frontend segue as rotas da seção 7. Pontos que o backend precisa respeitar:

- **Erros** no formato do FastAPI: `{"detail": "mensagem"}`. Falha de rede, 502 e 504 são tratados como 503.
- **`POST /pedidos`**, corpo: `{evento_id, participante, email, quantidade, meio: "CARTAO"|"PIX"|"BOLETO", final_cartao?}`. Respostas:
  - **201:** devolve o `Pedido` com `ingressos: string[]`. O campo `notificacao_enviada: false` é opcional e serve para avisar que o e-mail não saiu.
  - **402** (recusado), **409** (sem vagas) e **503** (Eventos ou Pagamento fora do ar). O texto de `detail` deve citar "Pagamento" ou "Eventos" para a tela escolher a mensagem certa.
- **`Pedido`:** `{id, evento_id, participante, email, quantidade, valor_total, estado, meio?, final_cartao?, motivo?}`.
- **`Ingresso`:** `{codigo, pedido_id, evento_id, estado}`. As telas de ingressos vendidos e de portaria também usam `participante` e `email`, que o Serviço de Ingressos pode pegar do próprio pedido.
- **`POST /ingressos/validar`**, corpo: `{codigo}`. Responde 200 com o ingresso, 404 ou 409.
- **Datas** em ISO sem fuso (`2026-12-12T19:00:00`). **Preço** é número.
- Não existe `GET /pedidos?email=`. A tela "Meus pedidos" junta os pedidos que têm ingressos (`GET /ingressos?email=`) com os pedidos feitos neste navegador. Assim os pedidos cancelados também aparecem.

## Estrutura

```
src/
├── api/          types.ts (contrato), http.ts (serviços reais), mock.ts (simulado), index.ts
├── components/   Layout, PainelServicos, ResultadoCompra, Estado, Aviso
├── pages/        Inicio, Eventos, Comprar, MeusPedidos, OrgEventos, OrgVendidos, Portaria
└── lib/          formato, perfil (participante no localStorage), useCarga
```
