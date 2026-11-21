import { httpApi } from './http';
import { mockApi, pedidosSimuladosPorEmail } from './mock';
import { pedidosLocais } from '../lib/perfil';
import type { Pedido } from './types';

// VITE_API_MODE=http usa os microsserviços reais; qualquer outro valor usa o backend simulado.
export const api = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi;

/**
 * Pedidos do participante. A API não tem "GET /pedidos?email=", então juntamos:
 * os pedidos que têm ingressos (GET /ingressos?email=) e os pedidos feitos neste
 * navegador (guardados localmente), o que inclui os cancelados.
 */
export async function pedidosDoParticipante(email: string): Promise<Pedido[]> {
  const ids = new Set<number>(pedidosLocais(email));
  if (api.modo === 'mock') {
    pedidosSimuladosPorEmail(email).forEach((id) => ids.add(id));
  } else {
    (await api.ingressosPorEmail(email)).forEach((i) => ids.add(i.pedido_id));
  }
  const pedidos = await Promise.all(
    [...ids].map((id) => api.obterPedido(id).catch(() => null)),
  );
  return pedidos.filter((p): p is Pedido => p !== null).sort((a, b) => b.id - a.id);
}

export * from './types';
export * from './errors';
