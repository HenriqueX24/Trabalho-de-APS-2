import type { MeioPagamento, Pedido } from '../api/types';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarPreco = (v: number) => moeda.format(v);

export function formatarData(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} · ${hora}`;
}

export function formatarDia(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}

/** "2026-12-12T19:00:00" -> valor para <input type="datetime-local"> */
export const paraInputData = (iso: string) => iso.slice(0, 16);

/** valor de <input type="datetime-local"> -> "2026-12-12T19:00:00" */
export const deInputData = (v: string) => (v.length === 16 ? `${v}:00` : v);

/** "80,00" ou "80.00" -> 80 */
export function lerPreco(v: string): number {
  const limpo = v.trim().replace(/\s|R\$/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normalizado);
}

export const precoParaInput = (v: number) => v.toFixed(2).replace('.', ',');

export const NOME_MEIO: Record<MeioPagamento, string> = {
  CARTAO: 'Cartão',
  PIX: 'PIX',
  BOLETO: 'Boleto',
};

export function descreverPagamento(p: Pick<Pedido, 'meio' | 'final_cartao'>) {
  if (!p.meio) return '';
  if (p.meio === 'CARTAO') return p.final_cartao ? `Cartão final ${p.final_cartao}` : 'Cartão';
  return NOME_MEIO[p.meio];
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
