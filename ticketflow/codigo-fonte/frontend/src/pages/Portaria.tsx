import { useRef, useState, type FormEvent } from 'react';
import { api, ApiError, statusDoErro, mensagemDoErro, type Evento, type Ingresso } from '../api';

interface Resposta {
  status: number;
  codigo: string;
  ingresso?: Ingresso;
  evento?: Evento;
  consulta?: boolean;
  mensagem?: string;
}

export function Portaria() {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [historico, setHistorico] = useState<Resposta[]>([]);
  const campo = useRef<HTMLInputElement>(null);

  async function executar(consulta: boolean) {
    const c = codigo.trim().toUpperCase();
    if (!c) {
      campo.current?.focus();
      return;
    }
    setEnviando(true);
    let r: Resposta;
    try {
      const ingresso = consulta ? await api.consultarIngresso(c) : await api.validarIngresso(c);
      const evento = await api.obterEvento(ingresso.evento_id).catch(() => undefined);
      r = { status: 200, codigo: c, ingresso, evento, consulta };
    } catch (err) {
      const dados = err instanceof ApiError ? (err.dados as Ingresso | undefined) : undefined;
      r = { status: statusDoErro(err), codigo: c, ingresso: dados && 'codigo' in dados ? dados : undefined, mensagem: mensagemDoErro(err), consulta };
    } finally {
      setEnviando(false);
    }
    setResposta(r);
    if (!consulta) setHistorico((h) => [r, ...h].slice(0, 8));
    if (!consulta && r.status !== 503) {
      setCodigo('');
    }
    campo.current?.focus();
  }

  function validar(e: FormEvent) {
    e.preventDefault();
    void executar(false);
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Validar ingresso</h1>
          <p className="subtitulo">Digite o código do ingresso do participante.</p>
        </div>
      </div>

      <form className="cartao cartao-validar" onSubmit={validar}>
        <label className="campo campo-codigo">
          <span>Código do ingresso</span>
          <input
            ref={campo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="TF-3-17-1"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="acoes-validar">
          <button type="button" className="btn btn-secundario" disabled={enviando} onClick={() => executar(true)}>
            Consultar
          </button>
          <button className="btn btn-primario btn-alto" disabled={enviando}>
            {enviando ? 'Validando…' : 'Validar'}
          </button>
        </div>
      </form>

      {resposta && <CartaoResposta r={resposta} />}

      {historico.length > 0 && (
        <section>
          <h2 className="titulo-secao">Últimas validações</h2>
          <ul className="historico">
            {historico.map((h, i) => (
              <li key={i} className={`hist-${tomDe(h)}`}>
                <code className="codigo-texto">{h.codigo}</code>
                <span>{tituloDe(h)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function tomDe(r: Resposta) {
  if (r.consulta && r.status === 200) return r.ingresso?.estado === 'UTILIZADO' ? 'aviso' : 'info';
  return r.status === 200 ? 'sucesso' : r.status === 409 ? 'aviso' : r.status === 503 ? 'neutro' : 'erro';
}

function tituloDe(r: Resposta) {
  if (r.consulta && r.status === 200) return `CONSULTA · ${r.ingresso?.estado}`;
  switch (r.status) {
    case 200:
      return 'ENTRADA LIBERADA';
    case 409:
      return 'JÁ UTILIZADO';
    case 404:
      return 'INGRESSO NÃO ENCONTRADO';
    case 503:
      return 'SERVIÇO INDISPONÍVEL';
    default:
      return 'ERRO';
  }
}

function CartaoResposta({ r }: { r: Resposta }) {
  const quem = [r.ingresso?.participante, r.evento?.nome].filter(Boolean).join(' · ');
  let texto: string;
  if (r.consulta && r.status === 200) {
    texto = `${quem}. ${r.ingresso?.estado === 'UTILIZADO' ? 'Este ingresso já foi usado.' : 'Ingresso válido, ainda não utilizado.'} A consulta não marca o ingresso.`;
  } else if (r.status === 200) {
    texto = `${quem}. O ingresso agora está como utilizado.`;
  } else if (r.status === 409) {
    texto = 'Este ingresso já foi usado. Não libere a entrada.';
  } else if (r.status === 404) {
    texto = 'O código não existe. Confira se foi digitado corretamente.';
  } else if (r.status === 503) {
    texto = 'O serviço de ingressos não respondeu. Tente novamente em instantes.';
  } else {
    texto = r.mensagem ?? 'Erro inesperado.';
  }

  return (
    <div className={`resposta-portaria tom-${tomDe(r)}`} role="status" aria-live="polite">
      <span className="resposta-rotulo">
        {r.status} · {tituloDe(r)}
      </span>
      <b className="resposta-codigo">{r.codigo}</b>
      <p>{texto}</p>
    </div>
  );
}
