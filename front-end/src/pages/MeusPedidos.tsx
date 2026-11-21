import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, pedidosDoParticipante, type Ingresso } from '../api';
import { Carregando, Falha } from '../components/Aviso';
import { Estado } from '../components/Estado';
import { descreverPagamento, formatarPreco, plural } from '../lib/formato';
import { participanteAtual, salvarParticipante } from '../lib/perfil';
import { useCarga } from '../lib/useCarga';

export function MeusPedidos() {
  const [email, setEmail] = useState(participanteAtual().email);
  const [rascunho, setRascunho] = useState(email);

  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    if (!email) return null;
    const [pedidos, ingressos, eventos] = await Promise.all([
      pedidosDoParticipante(email),
      api.ingressosPorEmail(email),
      api.listarEventos().catch(() => []),
    ]);
    return { pedidos, ingressos, eventos };
  }, [email]);

  function trocar(e: FormEvent) {
    e.preventDefault();
    const novo = rascunho.trim().toLowerCase();
    if (!novo) return;
    salvarParticipante({ ...participanteAtual(), email: novo });
    setEmail(novo);
  }

  const porPedido = new Map<number, Ingresso[]>();
  dados?.ingressos.forEach((i) => porPedido.set(i.pedido_id, [...(porPedido.get(i.pedido_id) ?? []), i]));
  const nomeEvento = (id: number) => dados?.eventos.find((e) => e.id === id)?.nome ?? `Evento #${id}`;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Meus pedidos e ingressos</h1>
          <p className="subtitulo">{email ? `Pedidos feitos com ${email}.` : 'Informe seu e-mail para ver seus pedidos.'}</p>
        </div>
        <form className="campo campo-busca form-inline" onSubmit={trocar}>
          <label htmlFor="email-pedidos">Outro e-mail</label>
          <div className="linha-inline">
            <input id="email-pedidos" type="email" value={rascunho} onChange={(e) => setRascunho(e.target.value)} placeholder="seu@email.com" />
            <button className="btn btn-secundario">Ver</button>
          </div>
        </form>
      </div>

      {carregando && !dados && <Carregando texto="Carregando pedidos…" />}
      {erro && <Falha onTentar={recarregar}>Não foi possível carregar seus pedidos. {erro}</Falha>}

      {dados && dados.pedidos.length === 0 && (
        <p className="vazio">
          Nenhum pedido encontrado para este e-mail. <Link to="/eventos">Ver eventos</Link>
        </p>
      )}

      <div className="lista">
        {dados?.pedidos.map((p) => {
          const ingressos = porPedido.get(p.id) ?? [];
          const partes = [
            `Pedido #${p.id}`,
            plural(p.quantidade, 'ingresso', 'ingressos'),
            formatarPreco(p.valor_total),
            descreverPagamento(p),
            p.estado === 'CANCELADO' ? p.motivo : null,
          ].filter(Boolean);
          return (
            <article key={p.id} className="cartao cartao-pedido">
              <div className="pedido-topo">
                <div>
                  <h2>{nomeEvento(p.evento_id)}</h2>
                  <p className="detalhe">{partes.join(' · ')}</p>
                </div>
                <Estado valor={p.estado} />
              </div>
              {ingressos.length > 0 && (
                <div className="grade-ingressos">
                  {ingressos.map((i) => (
                    <div key={i.codigo} className="ingresso">
                      <code className="codigo-texto">{i.codigo}</code>
                      <Estado valor={i.estado} />
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
