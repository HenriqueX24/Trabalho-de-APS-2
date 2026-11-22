import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, SERVICOS, type Servico } from '../api';
import { simulacao } from '../api/mock';

/**
 * Painel flutuante para a demonstração de tolerância a falhas (seção 6).
 * Modo simulado: liga/desliga cada serviço. Modo HTTP: mostra o GET /health de cada um.
 */
export function PainelServicos() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={`painel ${aberto ? 'aberto' : ''}`}>
      {aberto && (api.modo === 'mock' ? <Simulacao /> : <Saude />)}
      <button className="painel-botao" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
        {aberto ? 'Fechar' : api.modo === 'mock' ? 'Simular falhas' : 'Status dos serviços'}
      </button>
    </div>
  );
}

function Simulacao() {
  const falhas = useSyncExternalStore(simulacao.assinar, simulacao.falhas);
  const notificacoes = useSyncExternalStore(simulacao.assinar, () => JSON.stringify(simulacao.notificacoes()));
  const lista = JSON.parse(notificacoes) as ReturnType<typeof simulacao.notificacoes>;

  return (
    <div className="painel-caixa">
      <h2>Backend simulado</h2>
      <p className="painel-dica">Pare um serviço para ver como o sistema reage, como ao parar um container.</p>
      <ul className="painel-servicos">
        {SERVICOS.map((s) => (
          <li key={s.id}>
            <label>
              <input
                type="checkbox"
                checked={!falhas[s.id]}
                onChange={(e) => simulacao.definirFalha(s.id, !e.target.checked)}
              />
              <span className={`ponto ${falhas[s.id] ? 'fora' : 'no-ar'}`} aria-hidden />
              {s.nome} <small>:{s.porta}</small>
              <span className="painel-status">{falhas[s.id] ? 'fora do ar' : 'no ar'}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="painel-dica">Cartão com final <b>0000</b> é recusado (402).</p>
      <h3>Últimas notificações</h3>
      {lista.length === 0 ? (
        <p className="painel-dica">Nenhuma ainda.</p>
      ) : (
        <ul className="painel-notificacoes">
          {lista.map((n) => (
            <li key={n.id}>
              <b>{n.assunto}</b>
              <span>{n.destinatario}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        className="btn btn-secundario btn-pequeno"
        onClick={() => {
          if (confirm('Apagar os dados simulados e voltar aos dados iniciais?')) {
            simulacao.reiniciar();
            location.reload();
          }
        }}
      >
        Restaurar dados iniciais
      </button>
    </div>
  );
}

function Saude() {
  const [status, setStatus] = useState<Partial<Record<Servico, boolean>>>({});
  useEffect(() => {
    let vivo = true;
    const checar = () =>
      SERVICOS.forEach((s) =>
        api.saude(s.id).then((ok) => vivo && setStatus((st) => ({ ...st, [s.id]: ok }))),
      );
    checar();
    const t = setInterval(checar, 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="painel-caixa">
      <h2>Status dos serviços</h2>
      <p className="painel-dica">GET /health a cada 5 segundos.</p>
      <ul className="painel-servicos">
        {SERVICOS.map((s) => {
          const ok = status[s.id];
          return (
            <li key={s.id}>
              <label>
                <span className={`ponto ${ok === undefined ? '' : ok ? 'no-ar' : 'fora'}`} aria-hidden />
                {s.nome} <small>:{s.porta}</small>
                <span className="painel-status">{ok === undefined ? '…' : ok ? 'no ar' : 'fora do ar'}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
