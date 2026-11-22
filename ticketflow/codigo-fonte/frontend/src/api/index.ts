import { httpApi } from './http';
import { mockApi } from './mock';

// VITE_API_MODE=http usa os microsserviços reais; qualquer outro valor usa o backend simulado.
export const api = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi;

export * from './types';
export * from './errors';
