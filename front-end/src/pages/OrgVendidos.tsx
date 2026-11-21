import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Carregando, Falha } from '../components/Aviso';
import { Estado } from '../components/Estado';
import { formatarDia } from '../lib/formato';
import { useCarga } from '../lib/useCarga';

export function OrgVendidos() {
  const eventos = useCarga(() => api.listarEventos());
  const [eventoId, setEventoId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    if (eventoId === null && eventos.dados?.length) {
      setEventoId([...eventos.dados].sort((a, b) => a.data.localeCompare(b.data))[0].id);
    }
  }, [eventos.dados, eventoId]);

  const ingressos = useCarga(async () => (eventoId === null ? null : api.ingressosPorEvento(eventoId)), [eventoId]);
  const evento = eventos.dados?.find((e) => e.id === eventoId);

  const linhas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return (ingressos.dados ?? [])
      .filter((i) => !q || [i.codigo, i.participante, i.email].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.pedido_id - b.pedido_id || a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [ingressos.dados, filtro]);

  const utilizados = (ingressos.dados ?? []).filter((i) => i.estado === 'UTILIZADO').length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Ingressos vendidos</h1>
          <p className="subtitulo">{evento ? `${evento.nome} · ${formatarDia(evento.data)}` : 'Escolha um evento.'}</p>
        </div>
        <label className="campo campo-busca">
          <span>Evento</span>
          <select value={eventoId ?? ''} onChange={(e) => setEventoId(Number(e.target.value))} disabled={!eventos.dados}>
            {eventos.dados?.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {eventos.erro && <Falha onTentar={eventos.recarregar}>Não foi possível carregar os eventos. {eventos.erro}</Falha>}

      {evento && (
        <div className="grade-numeros">
          <div className="cartao numero">
            <span>Capacidade</span>
            <b>{evento.capacidade}</b>
          </div>
          <div className="cartao numero">
            <span>Vendidos</span>
            <b>{evento.capacidade - evento.vagas_disponiveis}</b>
          </div>
          <div className="cartao numero">
            <span>Vagas disponíveis</span>
            <b>{evento.vagas_disponiveis}</b>
          </div>
          <div className="cartao numero">
            <span>Já entraram</span>
            <b>{ingressos.dados ? utilizados : '—'}</b>
          </div>
        </div>
      )}

      {ingressos.erro && <Falha onTentar={ingressos.recarregar}>Não foi possível carregar os ingressos. {ingressos.erro}</Falha>}
      {ingressos.carregando && !ingressos.dados && eventoId !== null && <Carregando texto="Carregando ingressos…" />}

      {ingressos.dados && (
        <>
          <label className="campo campo-filtro">
            <span className="sr-only">Filtrar ingressos</span>
            <input type="search" placeholder="Filtrar por código, nome ou e-mail" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </label>
          {linhas.length === 0 ? (
            <p className="vazio">{filtro ? 'Nenhum ingresso corresponde ao filtro.' : 'Nenhum ingresso vendido para este evento.'}</p>
          ) : (
            <section className="tabela-caixa">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Participante</th>
                    <th>E-mail</th>
                    <th>Pedido</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((i) => (
                    <tr key={i.codigo}>
                      <td>
                        <code className="codigo-texto">{i.codigo}</code>
                      </td>
                      <td>{i.participante ?? '—'}</td>
                      <td>{i.email ?? '—'}</td>
                      <td>#{i.pedido_id}</td>
                      <td>
                        <Estado valor={i.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
