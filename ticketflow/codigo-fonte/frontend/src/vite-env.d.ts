/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "http" usa os microsserviços reais; qualquer outro valor (padrão) usa o backend simulado. */
  readonly VITE_API_MODE?: string;
  readonly VITE_EVENTOS_URL?: string;
  readonly VITE_INGRESSOS_URL?: string;
  readonly VITE_PAGAMENTO_URL?: string;
  readonly VITE_NOTIFICACOES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
