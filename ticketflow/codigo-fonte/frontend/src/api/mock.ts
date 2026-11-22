// Backend simulado no navegador, para demonstrar o frontend antes dos serviços existirem.
// Reproduz as regras da Descrição do Sistema: reserva atômica, compensação, estados do pedido,
// cartão final 0000 recusado, timeout de 2 s e falha de notificação apenas registrada.

import { ApiError } from './errors';
import type {
  Evento,
  EventoInput,
  EventoUpdate,
  Ingresso,
  Notificacao,
  Pedido,
  PedidoInput,
  Servico,
  TicketFlowApi,
} from './types';

interface Reserva {
  pedido_id: number;
  evento_id: number;
  quantidade: number;
  ativa: boolean;
}

interface Banco {
  eventos: Evento[];
  reservas: Reserva[];
  pedidos: Pedido[];
  ingressos: Ingresso[];
  notificacoes: Notificacao[];
  seq: { evento: number; pedido: number; notificacao: number };
}

export type Falhas = Record<Servico, boolean>;

const CHAVE_BANCO = 'ticketflow-mock-banco-v1';
const CHAVE_FALHAS = 'ticketflow-mock-falhas-v1';
const TIMEOUT_MS = 2000;
const LATENCIA_MS = 250;

// ---------- dados iniciais (os mesmos dos protótipos) ----------

const NOMES = ['Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiana'];
const SOBRENOMES = ['Alves', 'Barbosa', 'Costa', 'Ferreira', 'Gomes', 'Martins', 'Oliveira', 'Pereira', 'Rocha', 'Santos'];

function semente(): Banco {
  const eventos: Evento[] = [
    { id: 1, nome: 'Semana de Tecnologia CEFET', local: 'Campus Maracanã, Rio de Janeiro', data: '2026-12-03T09:00:00', preco: 25, capacidade: 200, vagas_disponiveis: 200 },
    { id: 2, nome: 'Stand-up na Lapa', local: 'Teatro da Lapa, Rio de Janeiro', data: '2026-12-19T21:00:00', preco: 60, capacidade: 150, vagas_disponiveis: 150 },
    { id: 3, nome: 'Festival de Jazz da Praça', local: 'Praça XV, Rio de Janeiro', data: '2026-12-12T19:00:00', preco: 80, capacidade: 400, vagas_disponiveis: 400 },
  ];
  const b: Banco = { eventos, reservas: [], pedidos: [], ingressos: [], notificacoes: [], seq: { evento: 3, pedido: 100, notificacao: 0 } };

  const vender = (id: number, evento_id: number, participante: string, email: string, quantidade: number, meio: Pedido['meio'], final_cartao: string | null, usados = 0) => {
    const ev = eventos.find((e) => e.id === evento_id)!;
    ev.vagas_disponiveis -= quantidade;
    b.reservas.push({ pedido_id: id, evento_id, quantidade, ativa: true });
    const codigos: string[] = [];
    for (let n = 1; n <= quantidade; n++) {
      const codigo = `TF-${evento_id}-${id}-${n}`;
      codigos.push(codigo);
      b.ingressos.push({ codigo, pedido_id: id, evento_id, estado: n <= usados ? 'UTILIZADO' : 'EMITIDO', participante, email });
    }
    b.pedidos.push({ id, evento_id, participante, email, quantidade, valor_total: ev.preco * quantidade, estado: 'CONCLUIDO', meio, final_cartao, ingressos: codigos, notificacao_enviada: true });
  };

  // Pedidos da Ana (tela "Meus pedidos")
  b.pedidos.push({ id: 9, evento_id: 2, participante: 'Ana Souza', email: 'ana@exemplo.com', quantidade: 2, valor_total: 120, estado: 'CANCELADO', meio: 'CARTAO', final_cartao: '0000', motivo: 'pagamento recusado, vagas liberadas', ingressos: [] });
  vender(12, 1, 'Ana Souza', 'ana@exemplo.com', 1, 'PIX', null);
  vender(17, 3, 'Ana Souza', 'ana@exemplo.com', 2, 'CARTAO', '4242');
  b.ingressos.find((i) => i.codigo === 'TF-3-17-2')!.estado = 'UTILIZADO';
  vender(18, 3, 'Bruno Lima', 'bruno@exemplo.com', 1, 'PIX', null);
  vender(19, 3, 'Carla Dias', 'carla@exemplo.com', 1, 'BOLETO', null);

  // Demais vendas, para os números ficarem parecidos com os protótipos.
  let k = 0;
  const gerar = (evento_id: number, ingressos: number) => {
    while (ingressos > 0) {
      const q = Math.min(ingressos, (k % 3) + 1);
      const nome = `${NOMES[k % NOMES.length]} ${SOBRENOMES[(k * 7) % SOBRENOMES.length]}`;
      const email = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + `${k}@exemplo.com`;
      const meio = (['CARTAO', 'PIX', 'BOLETO'] as const)[k % 3];
      vender(++b.seq.pedido, evento_id, nome, email, q, meio, meio === 'CARTAO' ? String(1000 + ((k * 37) % 9000)) : null, k % 4 === 0 ? 1 : 0);
      ingressos -= q;
      k++;
    }
  };
  gerar(1, 181); // sobram 18 vagas
  gerar(2, 150); // esgotado
  gerar(3, 276); // vendidos 280, sobram 120
  return b;
}

// ---------- persistência ----------

function carregar(): Banco {
  try {
    const s = localStorage.getItem(CHAVE_BANCO);
    if (s) return JSON.parse(s) as Banco;
  } catch {
    /* sem storage: usa semente */
  }
  return semente();
}

let banco = carregar();

function salvar() {
  try {
    localStorage.setItem(CHAVE_BANCO, JSON.stringify(banco));
  } catch {
    /* ignora */
  }
}

function carregarFalhas(): Falhas {
  try {
    const s = localStorage.getItem(CHAVE_FALHAS);
    if (s) return JSON.parse(s) as Falhas;
  } catch {
    /* ignora */
  }
  return { eventos: false, ingressos: false, pagamento: false, notificacoes: false };
}

let falhas = carregarFalhas();
const ouvintes = new Set<() => void>();

// Mantém as falhas simuladas iguais entre abas abertas.
window.addEventListener('storage', (e) => {
  if (e.key === CHAVE_FALHAS) {
    falhas = carregarFalhas();
    ouvintes.forEach((f) => f());
  }
});

export const simulacao = {
  falhas: () => falhas,
  definirFalha(servico: Servico, fora: boolean) {
    falhas = { ...falhas, [servico]: fora };
    try {
      localStorage.setItem(CHAVE_FALHAS, JSON.stringify(falhas));
    } catch {
      /* ignora */
    }
    ouvintes.forEach((f) => f());
  },
  notificacoes: () => banco.notificacoes.slice(-8).reverse(),
  reiniciar() {
    banco = semente();
    salvar();
    ouvintes.forEach((f) => f());
  },
  assinar(f: () => void) {
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  },
};

// ---------- utilidades ----------

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const NOME_SERVICO: Record<Servico, string> = { eventos: 'Eventos', ingressos: 'Ingressos', pagamento: 'Pagamento', notificacoes: 'Notificações' };

/** Chamada direta do navegador a um serviço: se está fora, erro de conexão (503). */
async function chamarDireto(servico: Servico) {
  await esperar(LATENCIA_MS);
  banco = carregar(); // outra aba pode ter alterado os dados
  if (falhas[servico]) throw new ApiError(503, `Serviço de ${NOME_SERVICO[servico]} indisponível.`);
}

/** Chamada entre serviços via Adapter: se o destino está fora, espera o timeout de 2 s. */
async function chamarServico(servico: Servico) {
  if (falhas[servico]) {
    await esperar(TIMEOUT_MS);
    return false;
  }
  await esperar(LATENCIA_MS);
  return true;
}

function eventoOu404(id: number) {
  const ev = banco.eventos.find((e) => e.id === id);
  if (!ev) throw new ApiError(404, 'Evento não encontrado.');
  return ev;
}

function liberarVagas(pedido_id: number) {
  const r = banco.reservas.find((x) => x.pedido_id === pedido_id && x.ativa);
  if (!r) return;
  r.ativa = false;
  eventoOu404(r.evento_id).vagas_disponiveis += r.quantidade;
}

function notificar(n: Omit<Notificacao, 'id' | 'status'>): boolean {
  if (falhas.notificacoes) {
    console.warn('[ingressos/eventos] Notificações fora do ar; falha registrada:', n.assunto);
    return false;
  }
  banco.notificacoes.push({ ...n, id: ++banco.seq.notificacao, status: 'ENVIADA' });
  return true;
}

// ---------- API simulada ----------

export const mockApi: TicketFlowApi = {
  modo: 'mock',

  async listarEventos() {
    await chamarDireto('eventos');
    return copia(banco.eventos);
  },

  async obterEvento(id) {
    await chamarDireto('eventos');
    return copia(eventoOu404(id));
  },

  async cadastrarEvento(dados: EventoInput) {
    await chamarDireto('eventos');
    if (!dados.nome?.trim() || !dados.local?.trim() || !dados.data) throw new ApiError(422, 'Preencha nome, local e data.');
    if (!(dados.capacidade > 0)) throw new ApiError(422, 'A capacidade deve ser maior que zero.');
    if (!(dados.preco >= 0)) throw new ApiError(422, 'O preço não pode ser negativo.');
    const ev: Evento = { ...dados, id: ++banco.seq.evento, vagas_disponiveis: dados.capacidade };
    banco.eventos.push(ev);
    salvar();
    return copia(ev);
  },

  async atualizarEvento(id, dados: EventoUpdate) {
    await chamarDireto('eventos');
    const ev = eventoOu404(id);
    Object.assign(ev, dados);
    salvar();
    // Observer: NotificacaoListener avisa os compradores; AuditoriaListener registra em log.
    console.info('[eventos/auditoria] Evento alterado', id, dados);
    const compradores = new Set(banco.pedidos.filter((p) => p.evento_id === id && p.estado === 'CONCLUIDO').map((p) => p.email));
    compradores.forEach((destinatario) =>
      notificar({ destinatario, canal: 'EMAIL', assunto: `Alteração no evento ${ev.nome}`, mensagem: `O evento foi alterado: ${ev.local}, ${ev.data}.`, evento_id: id }),
    );
    salvar();
    return copia(ev);
  },

  async excluirEvento(id) {
    await chamarDireto('eventos');
    eventoOu404(id);
    if (banco.reservas.some((r) => r.evento_id === id && r.ativa)) {
      throw new ApiError(409, 'O evento tem ingressos vendidos e não pode ser excluído.');
    }
    banco.eventos = banco.eventos.filter((e) => e.id !== id);
    banco.reservas = banco.reservas.filter((r) => r.evento_id !== id);
    salvar();
  },

  async criarPedido(dados: PedidoInput) {
    await chamarDireto('ingressos');
    if (!dados.participante?.trim() || !dados.email?.includes('@')) throw new ApiError(422, 'Informe nome e e-mail válidos.');
    if (!(dados.quantidade >= 1)) throw new ApiError(422, 'Quantidade inválida.');
    if (dados.meio === 'CARTAO' && !/^\d{4}$/.test(dados.final_cartao ?? '')) throw new ApiError(422, 'Informe os 4 últimos dígitos do cartão.');

    const pedido: Pedido = {
      id: ++banco.seq.pedido,
      evento_id: dados.evento_id,
      participante: dados.participante.trim(),
      email: dados.email.trim().toLowerCase(),
      quantidade: dados.quantidade,
      valor_total: 0,
      estado: 'CRIADO',
      meio: dados.meio,
      final_cartao: dados.meio === 'CARTAO' ? dados.final_cartao : null,
      ingressos: [],
    };
    banco.pedidos.push(pedido);

    const cancelar = (status: number, motivo: string, extra?: object) => {
      liberarVagas(pedido.id);
      pedido.estado = 'CANCELADO';
      pedido.motivo = motivo;
      salvar();
      throw new ApiError(status, motivo, { pedido: copia(pedido), ...extra });
    };

    // 1. Reservar vagas no Serviço de Eventos (atualização atômica).
    if (!(await chamarServico('eventos'))) cancelar(503, 'Serviço de Eventos não respondeu em 2 segundos.');
    const ev = banco.eventos.find((e) => e.id === dados.evento_id);
    if (!ev) cancelar(404, 'Evento não encontrado.');
    pedido.valor_total = ev!.preco * dados.quantidade;
    if (ev!.vagas_disponiveis < dados.quantidade) {
      cancelar(409, 'sem vagas suficientes', { vagas_disponiveis: ev!.vagas_disponiveis });
    }
    ev!.vagas_disponiveis -= dados.quantidade;
    banco.reservas.push({ pedido_id: pedido.id, evento_id: ev!.id, quantidade: dados.quantidade, ativa: true });
    pedido.estado = 'RESERVADO';
    salvar();

    // 2. Cobrar no Serviço de Pagamento (Strategy por meio; cartão final 0000 é recusado).
    if (!(await chamarServico('pagamento'))) cancelar(503, 'Serviço de Pagamento não respondeu em 2 segundos.');
    if (dados.meio === 'CARTAO' && dados.final_cartao === '0000') cancelar(402, 'pagamento recusado, vagas liberadas');
    pedido.estado = 'PAGO';

    // 3. Emitir ingressos e concluir.
    for (let n = 1; n <= pedido.quantidade; n++) {
      const codigo = `TF-${ev!.id}-${pedido.id}-${n}`;
      pedido.ingressos!.push(codigo);
      banco.ingressos.push({ codigo, pedido_id: pedido.id, evento_id: ev!.id, estado: 'EMITIDO', participante: pedido.participante, email: pedido.email });
    }
    pedido.estado = 'CONCLUIDO';

    // 4. Confirmação: falha não afeta a compra.
    pedido.notificacao_enviada = notificar({ destinatario: pedido.email, canal: 'EMAIL', assunto: 'Compra confirmada', mensagem: `Seus ingressos: ${pedido.ingressos!.join(', ')}`, evento_id: ev!.id });
    salvar();
    return copia(pedido);
  },

  async obterPedido(id) {
    await chamarDireto('ingressos');
    const p = banco.pedidos.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'Pedido não encontrado.');
    return copia(p);
  },

  async pedidosPorEmail(email) {
    await chamarDireto('ingressos');
    const e = email.trim().toLowerCase();
    return copia(banco.pedidos.filter((p) => p.email === e).sort((a, b) => b.id - a.id));
  },

  async ingressosPorEmail(email) {
    await chamarDireto('ingressos');
    const e = email.trim().toLowerCase();
    return copia(banco.ingressos.filter((i) => i.email === e));
  },

  async ingressosPorEvento(eventoId) {
    await chamarDireto('ingressos');
    return copia(banco.ingressos.filter((i) => i.evento_id === eventoId));
  },

  async consultarIngresso(codigo) {
    await chamarDireto('ingressos');
    const i = banco.ingressos.find((x) => x.codigo === codigo.trim().toUpperCase());
    if (!i) throw new ApiError(404, 'Ingresso não encontrado.');
    return copia(i);
  },

  async validarIngresso(codigo) {
    await chamarDireto('ingressos');
    const i = banco.ingressos.find((x) => x.codigo === codigo.trim().toUpperCase());
    if (!i) throw new ApiError(404, 'Ingresso não encontrado.');
    if (i.estado === 'UTILIZADO') throw new ApiError(409, 'Ingresso já utilizado.', copia(i));
    i.estado = 'UTILIZADO';
    salvar();
    return copia(i);
  },

  async saude(servico) {
    await esperar(80);
    return !falhas[servico];
  },
};
