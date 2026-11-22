/** Erro de API com o status HTTP. Falha de rede / timeout vira 503, como no cliente descrito na seção 6. */
export class ApiError extends Error {
  status: number;
  dados?: unknown;

  constructor(status: number, mensagem: string, dados?: unknown) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.dados = dados;
  }
}

export function statusDoErro(e: unknown): number {
  return e instanceof ApiError ? e.status : 503;
}

export function mensagemDoErro(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Erro inesperado.';
}
