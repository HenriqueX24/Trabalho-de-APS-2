import { useEffect, useState, type FormEvent } from 'react';
import { api, mensagemDoErro, type Evento } from '../api';
import { Carregando, Falha } from '../components/Aviso';
import { deInputData, formatarData, formatarPreco, lerPreco, paraInputData, precoParaInput } from '../lib/formato';
import { useCarga } from '../lib/useCarga';

type Msg = { tipo: 'ok' | 'erro'; texto: string } | null;

export function OrgEventos() {
  const { dados: eventos, erro, carregando, recarregar, setDados } = useCarga(() => api.listarEventos());
  const [selecionado, setSelecionado] = useState<number | null>(null);

  useEffect(() => {
    if (eventos?.length && (selecionado === null || !eventos.some((e) => e.id === selecionado))) {
      setSelecionado(eventos[0].id);
    }
  }, [eventos, selecionado]);

  const substituir = (ev: Evento) =>
    setDados((lista) => (lista ? (lista.some((e) => e.id === ev.id) ? lista.map((e) => (e.id === ev.id ? ev : e)) : [...lista, ev]) : [ev]));

  const evento = eventos?.find((e) => e.id === selecionado) ?? null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Meus eventos</h1>
          <p className="subtitulo">Cadastre eventos e altere data, local ou preço. Quem já comprou é avisado da mudança.</p>
        </div>
      </div>

      {erro && <Falha onTentar={recarregar}>Não foi possível falar com o serviço de eventos. {erro}</Falha>}

      <div className="grade-dupla">
        <NovoEvento
          onCriado={(ev) => {
            substituir(ev);
            setSelecionado(ev.id);
          }}
        />
        {evento ? (
          <AtualizarEvento
            key={evento.id}
            evento={evento}
            eventos={eventos ?? []}
            onSelecionar={setSelecionado}
            onSalvo={substituir}
          />
        ) : (
          <section className="cartao cartao-form">
            <h2>Atualizar evento</h2>
            {carregando ? <Carregando /> : <p className="dica">Nenhum evento cadastrado.</p>}
          </section>
        )}
      </div>

      {eventos && eventos.length > 0 && (
        <section className="tabela-caixa">
          <table className="tabela">
            <thead>
              <tr>
                <th>Id</th>
                <th>Evento</th>
                <th>Data</th>
                <th>Preço</th>
                <th>Vagas</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {[...eventos]
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((e) => (
                  <tr key={e.id} className={e.id === selecionado ? 'linha-ativa' : ''}>
                    <td>{e.id}</td>
                    <td>
                      <b>{e.nome}</b>
                      <div className="detalhe">{e.local}</div>
                    </td>
                    <td>{formatarData(e.data)}</td>
                    <td>{formatarPreco(e.preco)}</td>
                    <td>
                      {e.vagas_disponiveis} de {e.capacidade}
                    </td>
                    <td>
                      <button className="btn btn-texto" onClick={() => setSelecionado(e.id)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function NovoEvento({ onCriado }: { onCriado: (e: Evento) => void }) {
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [data, setData] = useState('');
  const [preco, setPreco] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const p = lerPreco(preco);
    const c = Number(capacidade);
    if (!nome.trim() || !local.trim() || !data) return setMsg({ tipo: 'erro', texto: 'Preencha nome, local e data.' });
    if (!Number.isFinite(p) || p < 0) return setMsg({ tipo: 'erro', texto: 'Preço inválido.' });
    if (!Number.isInteger(c) || c <= 0) return setMsg({ tipo: 'erro', texto: 'A capacidade deve ser um número inteiro maior que zero.' });
    setEnviando(true);
    try {
      const ev = await api.cadastrarEvento({ nome: nome.trim(), local: local.trim(), data: deInputData(data), preco: p, capacidade: c });
      onCriado(ev);
      setNome('');
      setLocal('');
      setData('');
      setPreco('');
      setCapacidade('');
      setMsg({ tipo: 'ok', texto: `Evento "${ev.nome}" cadastrado (id ${ev.id}).` });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemDoErro(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao cartao-form" onSubmit={enviar} noValidate>
      <h2>Cadastrar novo evento</h2>
      <label className="campo">
        <span>Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Festival de Jazz" />
      </label>
      <label className="campo">
        <span>Local</span>
        <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Praça XV, Rio de Janeiro" />
      </label>
      <div className="linha-campos tres">
        <label className="campo">
          <span>Data e hora</span>
          <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="campo">
          <span>Preço (R$)</span>
          <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="80,00" />
        </label>
        <label className="campo">
          <span>Capacidade</span>
          <input inputMode="numeric" value={capacidade} onChange={(e) => setCapacidade(e.target.value.replace(/\D/g, ''))} placeholder="400" />
        </label>
      </div>
      {msg && <p className={msg.tipo === 'ok' ? 'msg-ok' : 'erro-campo'}>{msg.texto}</p>}
      <div>
        <button className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar evento'}
        </button>
      </div>
    </form>
  );
}

function AtualizarEvento({
  evento,
  eventos,
  onSelecionar,
  onSalvo,
}: {
  evento: Evento;
  eventos: Evento[];
  onSelecionar: (id: number) => void;
  onSalvo: (e: Evento) => void;
}) {
  const [local, setLocal] = useState(evento.local);
  const [data, setData] = useState(paraInputData(evento.data));
  const [preco, setPreco] = useState(precoParaInput(evento.preco));
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const vendidos = evento.capacidade - evento.vagas_disponiveis;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const p = lerPreco(preco);
    if (!local.trim() || !data) return setMsg({ tipo: 'erro', texto: 'Preencha local e data.' });
    if (!Number.isFinite(p) || p < 0) return setMsg({ tipo: 'erro', texto: 'Preço inválido.' });
    setEnviando(true);
    try {
      const ev = await api.atualizarEvento(evento.id, { local: local.trim(), data: deInputData(data), preco: p });
      onSalvo(ev);
      setMsg({
        tipo: 'ok',
        texto: vendidos > 0 ? 'Evento atualizado. O aviso foi encaminhado aos compradores.' : 'Evento atualizado.',
      });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemDoErro(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="cartao cartao-form" onSubmit={enviar} noValidate>
      <div className="form-topo">
        <h2>Atualizar evento</h2>
        <select aria-label="Evento a atualizar" value={evento.id} onChange={(e) => onSelecionar(Number(e.target.value))}>
          {eventos.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nome} · id {ev.id}
            </option>
          ))}
        </select>
      </div>
      <label className="campo">
        <span>Local</span>
        <input value={local} onChange={(e) => setLocal(e.target.value)} />
      </label>
      <div className="linha-campos">
        <label className="campo">
          <span>Data e hora</span>
          <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="campo">
          <span>Preço (R$)</span>
          <input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </label>
      </div>
      <p className="nota">
        {vendidos > 0
          ? `Ao salvar, os compradores dos ${vendidos} ingressos já vendidos recebem um aviso sobre a alteração do evento.`
          : 'Este evento ainda não tem ingressos vendidos.'}
      </p>
      {msg && <p className={msg.tipo === 'ok' ? 'msg-ok' : 'erro-campo'}>{msg.texto}</p>}
      <div>
        <button className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Salvando…' : vendidos > 0 ? 'Salvar e avisar compradores' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
