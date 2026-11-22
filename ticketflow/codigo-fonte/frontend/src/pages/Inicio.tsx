import { Link } from 'react-router-dom';

const PERFIS = [
  {
    para: '/eventos',
    titulo: 'Participante',
    texto: 'Encontrar eventos, comprar ingressos e ver seus pedidos.',
  },
  {
    para: '/organizador/eventos',
    titulo: 'Organizador',
    texto: 'Cadastrar e alterar eventos, acompanhar vagas e ingressos vendidos.',
  },
  {
    para: '/portaria',
    titulo: 'Operador de portaria',
    texto: 'Validar o ingresso na entrada, sem uso duplicado.',
  },
];

export function Inicio() {
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Bem-vindo ao TicketFlow</h1>
          <p className="subtitulo">Escolha como você quer usar o sistema.</p>
        </div>
      </div>
      <div className="grade-perfis">
        {PERFIS.map((p) => (
          <Link key={p.para} to={p.para} className="cartao cartao-perfil">
            <h2>{p.titulo}</h2>
            <p>{p.texto}</p>
            <span className="link-seta">Entrar →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
