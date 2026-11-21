import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { participanteAtual } from '../lib/perfil';
import { PainelServicos } from './PainelServicos';

type Perfil = 'participante' | 'organizador' | 'portaria' | null;

function perfilDaRota(caminho: string): Perfil {
  if (caminho.startsWith('/organizador')) return 'organizador';
  if (caminho.startsWith('/portaria')) return 'portaria';
  if (caminho.startsWith('/eventos') || caminho.startsWith('/meus-pedidos')) return 'participante';
  return null;
}

const MENUS: Record<Exclude<Perfil, null>, { para: string; texto: string }[]> = {
  participante: [
    { para: '/eventos', texto: 'Eventos' },
    { para: '/meus-pedidos', texto: 'Meus pedidos' },
  ],
  organizador: [
    { para: '/organizador/eventos', texto: 'Eventos' },
    { para: '/organizador/vendidos', texto: 'Ingressos vendidos' },
  ],
  portaria: [{ para: '/portaria', texto: 'Portaria' }],
};

function useNomeParticipante() {
  const [nome, setNome] = useState(participanteAtual().nome);
  useEffect(() => {
    const f = () => setNome(participanteAtual().nome);
    window.addEventListener('ticketflow-perfil', f);
    return () => window.removeEventListener('ticketflow-perfil', f);
  }, []);
  return nome;
}

export function Layout() {
  const { pathname } = useLocation();
  const perfil = perfilDaRota(pathname);
  const nome = useNomeParticipante();

  const rotulo =
    perfil === 'participante'
      ? `Participante · ${nome || 'visitante'}`
      : perfil === 'organizador'
        ? 'Organizador · Casa de Shows Rio'
        : perfil === 'portaria'
          ? 'Operador · Portaria'
          : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-conteudo">
          <Link to="/" className="marca">
            TicketFlow
          </Link>
          {perfil && (
            <nav className="menu" aria-label="Navegação principal">
              {MENUS[perfil].map((m) => (
                <NavLink key={m.para} to={m.para} className={({ isActive }) => (isActive ? 'ativo' : '')}>
                  {m.texto}
                </NavLink>
              ))}
            </nav>
          )}
          <span className="espaco" />
          {rotulo && (
            <span className="perfil">
              {rotulo}
              <Link to="/" className="trocar">
                Trocar perfil
              </Link>
            </span>
          )}
        </div>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <PainelServicos />
    </div>
  );
}
