import { ApiError } from './errors';
import type {
  Evento,
  EventoInput,
  EventoUpdate,
  Ingresso,
  Pedido,
  PedidoInput,
  Servico,
  TicketFlowApi,
} from './types';

// Cada serviço é acessado por um prefixo; o Vite (dev) e o nginx (Docker) repassam ao container certo.
const BASE: Record<Servico, string> = {
  eventos: import.meta.env.VITE_EVENTOS_URL ?? '/svc/eventos',
  ingressos: import.meta.env.VITE_INGRESSOS_URL ?? '/svc/ingressos',
  pagamento: import.meta.env.VITE_PAGAMENTO_URL ?? '/svc/pagamento',
  notificacoes: import.meta.env.VITE_NOTIFICACOES_URL ?? '/svc/notificacoes',
};

const NOMES: Record<Servico, string> = {
  eventos: 'Eventos',
  ingressos: 'Ingressos',
  pagamento: 'Pagamento',
  notificacoes: 'Notificações',
};

// A compra pode esperar até 2 s por Eventos e mais 2 s por Pagamento; damos folga ao cliente.
const TIMEOUT_MS = 8000;

async function req<T>(servico: Servico, caminho: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(BASE[servico] + caminho, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(503, `Serviço de ${NOMES[servico]} indisponível.`);
  } finally {
    clearTimeout(t);
  }

  const texto = await resp.text();
  let corpo: unknown = undefined;
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }
  }

  if (!resp.ok) {
    // Proxy sem o serviço atrás (502/504) conta como serviço fora do ar.
    const status = resp.status === 502 || resp.status === 504 ? 503 : resp.status;
    const detalhe =
      corpo && typeof corpo === 'object' && 'detail' in corpo
        ? (corpo as { detail: unknown }).detail
        : corpo;
    const msg =
      typeof detalhe === 'string'
        ? detalhe
        : detalhe && typeof detalhe === 'object' && 'mensagem' in detalhe
          ? String((detalhe as { mensagem: unknown }).mensagem)
          : `Erro ${status} no serviço de ${NOMES[servico]}.`;
    throw new ApiError(status, msg, detalhe);
  }
  return corpo as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const httpApi: TicketFlowApi = {
  modo: 'http',

  listarEventos: () => req<Evento[]>('eventos', '/eventos'),
  obterEvento: (id) => req<Evento>('eventos', `/eventos/${id}`),
  cadastrarEvento: (dados: EventoInput) =>
    req<Evento>('eventos', '/eventos', { method: 'POST', body: json(dados) }),
  atualizarEvento: (id: number, dados: EventoUpdate) =>
    req<Evento>('eventos', `/eventos/${id}`, { method: 'PUT', body: json(dados) }),

  criarPedido: (dados: PedidoInput) =>
    req<Pedido>('ingressos', '/pedidos', { method: 'POST', body: json(dados) }),
  obterPedido: (id) => req<Pedido>('ingressos', `/pedidos/${id}`),
  ingressosPorEmail: (email) =>
    req<Ingresso[]>('ingressos', `/ingressos?email=${encodeURIComponent(email)}`),
  ingressosPorEvento: (eventoId) =>
    req<Ingresso[]>('ingressos', `/ingressos?evento_id=${eventoId}`),
  consultarIngresso: (codigo) =>
    req<Ingresso>('ingressos', `/ingressos/${encodeURIComponent(codigo)}`),
  validarIngresso: (codigo) =>
    req<Ingresso>('ingressos', '/ingressos/validar', { method: 'POST', body: json({ codigo }) }),

  saude: async (servico) => {
    try {
      await req(servico, '/health');
      return true;
    } catch {
      return false;
    }
  },
};
