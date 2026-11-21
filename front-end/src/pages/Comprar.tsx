import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, statusDoErro, mensagemDoErro, type MeioPagamento, type Pedido } from '../api';
import { Carregando, Falha } from '../components/Aviso';
import { ResultadoCompra, type Resultado } from '../components/ResultadoCompra';
import { formatarDia, formatarPreco, NOME_MEIO } from '../lib/formato';
import { lembrarPedido, participanteAtual, salvarParticipante } from '../lib/perfil';
import { useCarga } from '../lib/useCarga';

const MAX_POR_PEDIDO = 4;

export function Comprar() {
  const { id } = useParams();
  const eventoId = Number(id);
  const { dados: evento, erro, carregando, recarregar, setDados } = useCarga(() => api.obterEvento(eventoId), [eventoId]);

  const inicial = participanteAtual();
  const [nome, setNome] = useState(inicial.nome);
  const [email, setEmail] = useState(inicial.email);
  const [quantidade, setQuantidade] = useState(1);
  const [meio, setMeio] = useState<MeioPagamento>('CARTAO');
  const [finalCartao, setFinalCartao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  if (carregando && !evento) return <Carregando texto="Carregando evento…" />;
  if (erro || !evento)
    return (
      <>
        <Voltar />
        <Falha onTentar={recarregar}>Não foi possível carregar o evento. {erro}</Falha>
      </>
    );

  const maximo = Math.max(1, Math.min(MAX_POR_PEDIDO, evento.vagas_disponiveis));
  const total = evento.preco * quantidade;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    if (!nome.trim()) return setErroForm('Informe seu nome.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErroForm('Informe um e-mail válido.');
    if (meio === 'CARTAO' && !/^\d{4}$/.test(finalCartao)) return setErroForm('Informe os 4 últimos dígitos do cartão.');

    salvarParticipante({ nome, email });
    setEnviando(true);
    try {
      const pedido = await api.criarPedido({
        evento_id: eventoId,
        participante: nome.trim(),
        email: email.trim().toLowerCase(),
        quantidade,
        meio,
        final_cartao: meio === 'CARTAO' ? finalCartao : undefined,
      });
      lembrarPedido(email, pedido.id);
      setResultado({ status: 201, pedido, evento: evento! });
      // As vagas mudaram depois da compra; atualiza sem bloquear a tela.
      api.obterEvento(eventoId).then(setDados).catch(() => undefined);
    } catch (err) {
      const status = statusDoErro(err);
      if (status === 422 || status === 400) {
        setErroForm(mensagemDoErro(err));
        return;
      }
      const pedido = extrairPedido(err);
      if (pedido) lembrarPedido(email, pedido.id);
      // Atualiza as vagas: no 409 mostramos quantas restam.
      const atual = await api.obterEvento(eventoId).catch(() => evento!);
      setDados(atual);
      setResultado({ status, pedido, evento: atual, quantidadePedida: quantidade, mensagem: mensagemDoErro(err) });
    } finally {
      setEnviando(false);
    }
  }

  function tentarDeNovo() {
    setResultado(null);
    setQuantidade((q) => Math.min(q, Math.max(1, evento!.vagas_disponiveis)));
  }

  if (resultado) {
    return (
      <>
        <Voltar />
        <h1 className="titulo-pagina">Comprar ingresso</h1>
        <ResultadoCompra resultado={resultado} onTentarNovamente={tentarDeNovo} />
      </>
    );
  }

  const esgotado = evento.vagas_disponiveis <= 0;

  return (
    <>
      <Voltar />
      <h1 className="titulo-pagina">Comprar ingresso</h1>
      <form className="grade-compra" onSubmit={enviar} noValidate>
        <section className="cartao cartao-form">
          <h2>Seus dados</h2>
          <div className="linha-campos">
            <label className="campo">
              <span>Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
            </label>
            <label className="campo">
              <span>E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          </div>
          <label className="campo campo-curto">
            <span>Quantidade</span>
            <select value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} disabled={esgotado}>
              {Array.from({ length: maximo }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <h2>Forma de pagamento</h2>
          <div className="opcoes-pagamento" role="radiogroup" aria-label="Forma de pagamento">
            {(Object.keys(NOME_MEIO) as MeioPagamento[]).map((m) => (
              <label key={m} className={`opcao ${meio === m ? 'selecionada' : ''}`}>
                <input type="radio" name="meio" value={m} checked={meio === m} onChange={() => setMeio(m)} />
                {NOME_MEIO[m]}
              </label>
            ))}
          </div>
          {meio === 'CARTAO' && (
            <label className="campo campo-medio">
              <span>Final do cartão (4 dígitos)</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={finalCartao}
                placeholder="4242"
                onChange={(e) => setFinalCartao(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
          )}
          {meio === 'PIX' && <p className="dica">O PIX é aprovado na hora (simulado).</p>}
          {meio === 'BOLETO' && <p className="dica">O boleto é aprovado na hora (simulado).</p>}
        </section>

        <aside className="cartao cartao-resumo">
          <h2>Resumo do pedido</h2>
          <div className="resumo-evento">
            <b>{evento.nome}</b>
            <span>
              {formatarDia(evento.data)} · {evento.local.split(',')[0]}
            </span>
          </div>
          <hr />
          <div className="resumo-linha">
            <span>
              {quantidade} × {formatarPreco(evento.preco)}
            </span>
            <span>{formatarPreco(total)}</span>
          </div>
          <div className="resumo-linha resumo-total">
            <span>Total</span>
            <span>{formatarPreco(total)}</span>
          </div>
          {erroForm && (
            <p className="erro-campo" role="alert">
              {erroForm}
            </p>
          )}
          <button type="submit" className="btn btn-primario btn-largo" disabled={enviando || esgotado}>
            {esgotado ? 'Esgotado' : enviando ? 'Processando…' : 'Pagar e confirmar'}
          </button>
          {enviando && <p className="dica">Reservando vagas e cobrando… pode levar alguns segundos.</p>}
          <p className="dica">
            As vagas são reservadas, o pagamento é cobrado e os ingressos são emitidos. Você recebe a confirmação por e-mail.
          </p>
        </aside>
      </form>
    </>
  );
}

function Voltar() {
  return (
    <Link to="/eventos" className="voltar">
      ← Voltar aos eventos
    </Link>
  );
}

function extrairPedido(err: unknown): Pedido | undefined {
  if (!(err instanceof ApiError) || !err.dados || typeof err.dados !== 'object') return undefined;
  const d = err.dados as { pedido?: Pedido };
  return d.pedido;
}

