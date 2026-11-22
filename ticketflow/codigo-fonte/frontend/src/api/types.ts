// Tipos espelhando a visão de informação (Descrição do Sistema, seção 5.2).

export interface Evento {
  id: number;
  nome: string;
  local: string;
  /** ISO 8601 sem fuso, ex.: "2026-12-12T19:00:00" */
  data: string;
  preco: number;
  capacidade: number;
  vagas_disponiveis: number;
}

export type EventoInput = Omit<Evento, 'id' | 'vagas_disponiveis'>;
export type EventoUpdate = Partial<Pick<Evento, 'nome' | 'local' | 'data' | 'preco'>>;

export type EstadoPedido = 'CRIADO' | 'RESERVADO' | 'PAGO' | 'CONCLUIDO' | 'CANCELADO';
export type EstadoIngresso = 'EMITIDO' | 'UTILIZADO';
export type MeioPagamento = 'CARTAO' | 'PIX' | 'BOLETO';

export interface Pedido {
  id: number;
  evento_id: number;
  participante: string;
  email: string;
  quantidade: number;
  valor_total: number;
  estado: EstadoPedido;
  meio?: MeioPagamento;
  final_cartao?: string | null;
  /** Motivo do cancelamento, quando houver (ex.: "pagamento recusado"). */
  motivo?: string | null;
  /** Códigos dos ingressos emitidos (pedido CONCLUIDO). */
  ingressos?: string[];
  /** false quando o Serviço de Notificações não respondeu (a compra continua válida). */
  notificacao_enviada?: boolean;
}

export interface PedidoInput {
  evento_id: number;
  participante: string;
  email: string;
  quantidade: number;
  meio: MeioPagamento;
  final_cartao?: string;
}

export interface Ingresso {
  codigo: string;
  pedido_id: number;
  evento_id: number;
  estado: EstadoIngresso;
  participante?: string;
  email?: string;
}

export interface Notificacao {
  id: number;
  destinatario: string;
  canal: 'EMAIL' | 'SMS';
  assunto: string;
  mensagem: string;
  evento_id?: number | null;
  status: 'ENVIADA' | 'FALHA';
}

export type Servico = 'eventos' | 'ingressos' | 'pagamento' | 'notificacoes';

export const SERVICOS: { id: Servico; nome: string; porta: number }[] = [
  { id: 'eventos', nome: 'Eventos', porta: 8081 },
  { id: 'ingressos', nome: 'Ingressos', porta: 8082 },
  { id: 'pagamento', nome: 'Pagamento', porta: 8083 },
  { id: 'notificacoes', nome: 'Notificações', porta: 8084 },
];

/** Contrato usado pelas telas. Há duas implementações: HTTP (serviços reais) e simulada. */
export interface TicketFlowApi {
  modo: 'http' | 'mock';
  listarEventos(): Promise<Evento[]>;
  obterEvento(id: number): Promise<Evento>;
  cadastrarEvento(dados: EventoInput): Promise<Evento>;
  atualizarEvento(id: number, dados: EventoUpdate): Promise<Evento>;
  excluirEvento(id: number): Promise<void>;
  criarPedido(dados: PedidoInput): Promise<Pedido>;
  obterPedido(id: number): Promise<Pedido>;
  pedidosPorEmail(email: string): Promise<Pedido[]>;
  ingressosPorEmail(email: string): Promise<Ingresso[]>;
  ingressosPorEvento(eventoId: number): Promise<Ingresso[]>;
  consultarIngresso(codigo: string): Promise<Ingresso>;
  validarIngresso(codigo: string): Promise<Ingresso>;
  saude(servico: Servico): Promise<boolean>;
}
