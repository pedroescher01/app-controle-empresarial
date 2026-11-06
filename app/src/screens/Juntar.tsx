import { useMemo, useState } from 'react';
import { useConfig, useOrcamentos } from '../lib/hooks';
import { calcular } from '../lib/calc';
import { chaveCliente, juntar, podeJuntar } from '../lib/juntar';
import { brl, fmtData, iniciais, qtd } from '../lib/format';
import { go, replace } from '../lib/router';
import { Empty, Icon, TopBar, useToast } from '../components/ui';
import { juntarOrcamentos } from './orcamentoActions';

export function Juntar() {
  const orcs = useOrcamentos();
  const cfg = useConfig();
  const toast = useToast();
  const [grupo, setGrupo] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [juntando, setJuntando] = useState(false);

  const grupos = useMemo(() => {
    const g = new Map<string, typeof orcs>();
    orcs.filter(podeJuntar).forEach((o) => g.set(chaveCliente(o), [...(g.get(chaveCliente(o)) ?? []), o]));
    return [...g.entries()].filter(([, l]) => l.length >= 2).map(([k, l]) => ({ k, nome: l[0].clienteNome || 'Sem nome', lista: [...l].sort((a, b) => a.emitidoEm.localeCompare(b.emitidoEm)) }));
  }, [orcs]);

  const atual = grupos.find((g) => g.k === grupo);
  const escolhidos = atual ? atual.lista.filter((o) => marcados.has(o.id)) : [];
  const previa = escolhidos.length >= 2 ? juntar(escolhidos, cfg) : null;
  const metros = previa?.itens.find((i) => i.tipo === 'metro')?.quantidade ?? 0;

  const abrir = (k: string) => {
    setGrupo(k);
    setMarcados(new Set(grupos.find((g) => g.k === k)?.lista.map((o) => o.id)));
  };

  if (!atual) {
    return (
      <section className="stack">
        <TopBar onBack={() => go('orcamentos')} backLabel="Orçamentos" eyebrow="Juntar orçamentos" title="De qual cliente?" />
        {!grupos.length ? (
          <Empty icon="copy" title="Nada para juntar" text="Precisa ter 2 ou mais orçamentos do mesmo cliente, sem pagamento e sem ter sido juntado antes." />
        ) : (
          <div className="card list">
            {grupos.map((g) => (
              <button key={g.k} className="row" onClick={() => abrir(g.k)}>
                <div className="avatar">{iniciais(g.nome)}</div>
                <div className="main"><div className="t">{g.nome}</div><div className="s">{g.lista.length} orçamentos · {g.lista.map((o) => `nº ${o.numero}`).join(', ')}</div></div>
                <Icon name="chev" className="chev" />
              </button>
            ))}
          </div>
        )}
        <p className="hint">Orçamentos já pagos (mesmo em parte) não aparecem aqui.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <TopBar onBack={() => setGrupo(null)} backLabel="Clientes" eyebrow="Juntar orçamentos" title={atual.nome} />
      <div className="label" style={{ paddingLeft: 2 }}>Quais orçamentos entram?</div>
      <div className="card list">
        {atual.lista.map((o) => {
          const on = marcados.has(o.id);
          return (
            <button key={o.id} className="row" onClick={() => { const n = new Set(marcados); if (on) n.delete(o.id); else n.add(o.id); setMarcados(n); }} aria-pressed={on}>
              <span className={`check ${on ? 'on' : ''}`} aria-hidden="true">{on && <Icon name="check" />}</span>
              <div className="main"><div className="t">Nº {o.numero}</div><div className="s">{fmtData(o.servicoData ?? o.emitidoEm)} · {o.itens.length} ite{o.itens.length === 1 ? 'm' : 'ns'}</div></div>
              <div className="v">{brl(calcular(o, cfg).total)}</div>
            </button>
          );
        })}
      </div>

      {previa ? (
        <div className="card list">
          <div className="kv"><span className="k">Orçamento novo</span><span>emitido hoje</span></div>
          {metros > 0 && <div className="kv"><span className="k">Calhas e rufos</span><span className="v">{qtd(metros)} m</span></div>}
          <div className="kv"><span className="k">Itens</span><span className="v">{previa.itens.length}</span></div>
          {previa.desconto > 0 && <div className="kv"><span className="k">Desconto somado</span><span className="v">{brl(previa.desconto)}</span></div>}
          <div className="kv total"><span className="k">Total</span><span className="v">{brl(previa.total)}</span></div>
          <div className="kv"><span className="small muted">{previa.observacao}</span></div>
        </div>
      ) : <p className="hint">Marque pelo menos 2 orçamentos.</p>}

      <button className="btn block primary" disabled={!previa || juntando} onClick={async () => {
        setJuntando(true);
        const novo = await juntarOrcamentos(escolhidos);
        toast(`${escolhidos.length} orçamentos juntados no nº ${novo.numero}`);
        replace(`orcamento/${novo.id}`);
      }}><Icon name="copy" />Juntar {escolhidos.length >= 2 ? `${escolhidos.length} orçamentos` : ''}</button>
      <p className="hint" style={{ textAlign: 'center' }}>Os orçamentos antigos ficam guardados com a marca “Juntado”. Dá para separar de novo depois.</p>
    </section>
  );
}
