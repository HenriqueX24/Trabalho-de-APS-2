import type { ReactNode } from 'react';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <p className="carregando" role="status">
      <span className="spinner" aria-hidden /> {texto}
    </p>
  );
}

export function Falha({ children, onTentar }: { children: ReactNode; onTentar?: () => void }) {
  return (
    <div className="falha" role="alert">
      <span>{children}</span>
      {onTentar && (
        <button className="btn btn-secundario btn-pequeno" onClick={onTentar}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
