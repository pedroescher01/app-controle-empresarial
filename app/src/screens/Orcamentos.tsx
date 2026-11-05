import { useMemo, useState } from 'react';
import { useConfig, useOrcamentos } from '../lib/hooks';
import { calcular, statusVisual } from '../lib/calc';
import { brl, fmtData, semAcento } from '../lib/format';
import { go } from '../lib/router';
import { Empty, Icon, Pill, TopBar } from '../components/ui';
import { criarOrcamento } from './orcamentoActions';

const FILTROS = [
  { k: 'todos', l: 'Todos' },
  { k: 'aguardando', l: 'Aguardando' },
  { k: 'receber', l: 'A receber' },
  { k: 'quitado', l: 'Quitados' },
  { k: 'rascunho', l: 'Rascunhos' },
  { k: 'recusado', l: 'Recusados' },
];

export async function novoOrcamento() {
  const o = await criarOrcamento();
  go(`orcamento/${o.id}`);
}

export function OrcamentosLista() {
  const cfg = useConfig();
  const orcs = useOrcamentos();
  const [q, setQ] = useState('');
  const [f, setF] = useState('todos');

  const linhas = useMemo(() => orcs.map((o) => {
    const r = calcular(o, cfg);
    return { o, total: r.total, st: statusVisual(o, r.total) };
  }), [orcs, cfg]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    linhas.forEach((l) => (c[l.st.chave] = (c[l.st.chave] ?? 0) + 1));
    return c;
  }, [linhas]);

  const lista = useMemo(() => {
    const t = semAcento(q.trim());
    return linhas.filter(({ o, st }) => (f === 'todos' || st.chave === f) && (!t || String(o.numero).includes(t) || semAcento(o.clienteNome).includes(t)));
  }, [linhas, q, f]);

  return (
    <section className="stack">
      <TopBar eyebrow={`${orcs.length} no total`} title="Orçamentos" right={<button className="icon-btn red" aria-label="Novo orçamento" onClick={novoOrcamento}><Icon name="plus" /></button>} />
      <div className="search">
        <Icon name="search" />
        <input className="input" type="search" inputMode="search" placeholder="Número ou nome do cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar orçamento" />
      </div>
      <div className="chips">
        {FILTROS.filter((x) => x.k === 'todos' || contagem[x.k]).map((x) => (
          <button key={x.k} className="chip" aria-pressed={f === x.k} onClick={() => setF(x.k)}>
            {x.l}{x.k !== 'todos' && <span className="faint" style={{ fontWeight: 500 }}>{contagem[x.k]}</span>}
          </button>
        ))}
      </div>
      {!orcs.length ? (
        <Empty icon="doc" title="Nenhum orçamento ainda" text="Crie o primeiro. Ele vai direto em PDF para o WhatsApp do cliente." action={<button className="btn primary" onClick={novoOrcamento}><Icon name="plus" />Novo orçamento</button>} />
      ) : !lista.length ? (
        <Empty icon="search" title="Nada encontrado" text="Tente outro número ou nome." />
      ) : (
        <div className="card list">
          {lista.map(({ o, total, st }) => (
            <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
              <div className="main">
                <div className="t">{o.clienteNome || 'Sem cliente'}</div>
                <div className="s num">Nº {o.numero} · {fmtData(o.emitidoEm)}</div>
              </div>
              <div className="v" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {brl(total)}
                <Pill cor={st.cor}>{st.rotulo}</Pill>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
