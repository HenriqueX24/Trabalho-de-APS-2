// Identidade do participante guardada no navegador (não há login no TicketFlow).

const CHAVE_PERFIL = 'ticketflow-participante';

export interface Participante {
  nome: string;
  email: string;
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const s = localStorage.getItem(chave);
    return s ? (JSON.parse(s) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem storage disponível */
  }
}

export function participanteAtual(): Participante {
  return ler<Participante>(CHAVE_PERFIL, { nome: 'Ana Souza', email: 'ana@exemplo.com' });
}

export function salvarParticipante(p: Participante) {
  gravar(CHAVE_PERFIL, { nome: p.nome.trim(), email: p.email.trim().toLowerCase() });
  window.dispatchEvent(new Event('ticketflow-perfil'));
}
