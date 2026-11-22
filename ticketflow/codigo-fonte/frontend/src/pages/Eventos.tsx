import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Evento } from '../api';
import { Carregando, Falha } from '../components/Aviso';
import { formatarData, formatarPreco } from '../lib/formato';
import { useCarga } from '../lib/useCarga';

export function BarraVagas({ evento }: { evento: Evento }) {
  const fracao = evento.capacidade > 0 ? evento.vagas_disponiveis / evento.capacidade : 0;
  const tom = fracao === 0 ? 'vazia' : fracao < 0.15 ? 'baixa' : 'ok';
  return (
    <div className="vagas">
      <div className="vagas-linha">
        <b>{evento.vagas_disponiveis === 1 ? '1 vaga' : `${evento.vagas_disponiveis} vagas`}</b>
        <span>de {evento.capacidade}</span>
      </div>
      <div
        className="vagas-barra"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={evento.capacidade}
        aria-valuenow={evento.vagas_disponiveis}
        aria-label="Vagas disponíveis"
      >
        <span className={`vagas-preenchida ${tom}`} style={{ width: `${Math.max(fracao * 100, fracao > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

export function Eventos() {
  const { dados, erro, carregando, recarregar } = useCarga(() => api.listarEventos());
  const [busca, setBusca] = useState('');

  const eventos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados ?? [])
      .filter((e) => !q || e.nome.toLowerCase().includes(q) || e.local.toLowerCase().includes(q))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [dados, busca]);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Eventos disponíveis</h1>
          <p className="subtitulo">Escolha um evento e compre seu ingresso. As vagas mostradas são as disponíveis agora.</p>
        </div>
        <label className="campo campo-busca">
          <span>Buscar evento</span>
          <input type="search" placeholder="Nome ou local" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      {carregando && !dados && <Carregando texto="Carregando eventos…" />}
      {erro && <Falha onTentar={recarregar}>Não foi possível carregar os eventos. {erro}</Falha>}

      {dados && eventos.length === 0 && (
        <p className="vazio">{busca ? 'Nenhum evento encontrado para essa busca.' : 'Nenhum evento cadastrado ainda.'}</p>
      )}

      <div className="grade-eventos">
        {eventos.map((ev) => {
          const esgotado = ev.vagas_disponiveis <= 0;
          return (
            <article key={ev.id} className="cartao cartao-evento">
              <h2>{ev.nome}</h2>
              <p className="detalhe">
                {ev.local}
                <br />
                {formatarData(ev.data)}
              </p>
              <BarraVagas evento={ev} />
              <div className="rodape-evento">
                <span className="preco">{formatarPreco(ev.preco)}</span>
                {esgotado ? (
                  <span className="btn btn-desabilitado" aria-disabled>
                    Esgotado
                  </span>
                ) : (
                  <Link to={`/eventos/${ev.id}/comprar`} className="btn btn-primario">
                    Comprar
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
