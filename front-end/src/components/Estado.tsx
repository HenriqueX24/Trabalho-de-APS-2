import type { EstadoIngresso, EstadoPedido } from '../api/types';

const ROTULO: Record<string, string> = {
  CRIADO: 'CRIADO',
  RESERVADO: 'RESERVADO',
  PAGO: 'PAGO',
  CONCLUIDO: 'CONCLUÍDO',
  CANCELADO: 'CANCELADO',
  EMITIDO: 'EMITIDO',
  UTILIZADO: 'UTILIZADO',
};

const TOM: Record<string, string> = {
  CONCLUIDO: 'sucesso',
  CANCELADO: 'erro',
  EMITIDO: 'info',
  UTILIZADO: 'neutro',
  CRIADO: 'neutro',
  RESERVADO: 'aviso',
  PAGO: 'info',
};

export function Estado({ valor }: { valor: EstadoPedido | EstadoIngresso }) {
  return <span className={`estado estado-${TOM[valor] ?? 'neutro'}`}>{ROTULO[valor] ?? valor}</span>;
}
