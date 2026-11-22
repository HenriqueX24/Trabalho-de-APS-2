import { Link } from 'react-router-dom';
import type { Evento, Pedido } from '../api';
import { descreverPagamento, formatarPreco, plural } from '../lib/formato';

export interface Resultado {
  status: number;
  evento: Evento;
  pedido?: Pedido;
  quantidadePedida?: number;
  mensagem?: string;
}

/** As respostas da tela de compra (protótipo "Resultados da compra"): 201, 402, 409 e 503. */
export function ResultadoCompra({ resultado, onTentarNovamente }: { resultado: Resultado; onTentarNovamente: () => void }) {
  const { status, evento, pedido } = resultado;

  if (status === 201 && pedido) {
    const pagamento = descreverPagamento(pedido);
    return (
      <section className="cartao resultado tom-sucesso">
        <span className="selo">Pedido concluído · 201</span>
        <h2>Compra confirmada!</h2>
        <p>
          {evento.nome} · {plural(pedido.quantidade, 'ingresso', 'ingressos')} · {formatarPreco(pedido.valor_total)} pagos
          {pagamento ? ` com ${pagamento.charAt(0).toLowerCase()}${pagamento.slice(1)}` : ''}.{' '}
          {pedido.notificacao_enviada === false
            ? 'O serviço de notificações está fora do ar, então o e-mail de confirmação não foi enviado — mas a compra está garantida.'
            : `Enviamos a confirmação para ${pedido.email}.`}
        </p>
        <div className="codigos">
          {(pedido.ingressos ?? []).map((c) => (
            <code key={c} className="codigo">
              {c}
            </code>
          ))}
        </div>
        <Link to="/meus-pedidos" className="btn btn-primario">
          Ver meus ingressos
        </Link>
        <p className="dica">Pedido #{pedido.id}. Apresente o código do ingresso na portaria.</p>
      </section>
    );
  }

  if (status === 402) {
    return (
      <section className="cartao resultado tom-erro">
        <span className="selo">Pagamento recusado · 402</span>
        <h2>O pagamento foi recusado</h2>
        <p>
          Não cobramos seu cartão e as vagas reservadas foram liberadas. O pedido ficou como cancelado. Tente outro cartão ou
          outro meio de pagamento.
        </p>
        <button className="btn btn-primario" onClick={onTentarNovamente}>
          Tentar novamente
        </button>
      </section>
    );
  }

  if (status === 409) {
    const restam = evento.vagas_disponiveis;
    return (
      <section className="cartao resultado tom-aviso">
        <span className="selo">Sem vagas · 409</span>
        <h2>Não há vagas suficientes</h2>
        <p>
          {restam === 0
            ? 'O evento esgotou.'
            : `${restam === 1 ? 'Resta 1 vaga' : `Restam ${restam} vagas`} para este evento e você pediu ${resultado.quantidadePedida}.`}{' '}
          Nenhum valor foi cobrado. {restam > 0 ? 'Reduza a quantidade ou escolha outro evento.' : 'Escolha outro evento.'}
        </p>
        <div className="acoes">
          <Link to="/eventos" className="btn btn-secundario">
            Ver outros eventos
          </Link>
          {restam > 0 && (
            <button className="btn btn-texto" onClick={onTentarNovamente}>
              Reduzir quantidade
            </button>
          )}
        </div>
      </section>
    );
  }

  if (status === 503) {
    const msg = resultado.mensagem ?? '';
    const qual = /pagamento/i.test(msg) ? 'pagamento' : /eventos/i.test(msg) ? 'eventos' : /ingressos/i.test(msg) ? 'ingressos' : null;
    return (
      <section className="cartao resultado tom-neutro">
        <span className="selo">{qual === 'pagamento' ? 'Pagamento indisponível' : 'Serviço indisponível'} · 503</span>
        <h2>{qual === 'pagamento' ? 'Não foi possível cobrar agora' : 'Não foi possível concluir a compra agora'}</h2>
        <p>
          {qual === 'pagamento'
            ? 'O serviço de pagamento não respondeu. As vagas foram liberadas e o pedido foi cancelado, sem cobrança.'
            : qual === 'eventos'
              ? 'O serviço de eventos não respondeu para reservar as vagas. O pedido foi cancelado, sem cobrança.'
              : 'O serviço de ingressos não está respondendo. Nenhum valor foi cobrado.'}{' '}
          Tente de novo em alguns minutos.
          {qual !== 'eventos' && ' A lista de eventos continua funcionando.'}
        </p>
        <button className="btn btn-primario" onClick={onTentarNovamente}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="cartao resultado tom-erro">
      <span className="selo">Erro · {status}</span>
      <h2>Não foi possível concluir a compra</h2>
      <p>{resultado.mensagem}</p>
      <button className="btn btn-primario" onClick={onTentarNovamente}>
        Tentar novamente
      </button>
    </section>
  );
}
