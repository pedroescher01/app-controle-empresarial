import { useEffect, useMemo, useState } from 'react';
import { db, setConfig, type ContaFixa, type Lancamento } from '../lib/db';
import { go } from '../lib/router';
import { useConfig, useContasFixas, useLancamentos } from '../lib/hooks';
import { CONTAS, FORMAS_PAGAMENTO, contaPadrao } from '../lib/catalog';
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, DIAS_SEMANA, doMes, hojeMes, liquido, nomeMesAno, resumo, somarMes, vencimentos, type Vencimento } from '../lib/financeiro';
import { brl, fmtData, fmtDataCurta, hojeISO, parseDecimal, uid } from '../lib/format';
import { Confirm, Empty, Icon, MoneyInput, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { compartilharArquivo } from '../lib/share';
import { PixSheet } from '../components/PixSheet';

// ======================= MÊS =======================
export function Financeiro({ mes: mesRota }: { mes?: string }) {
  const lancs = useLancamentos();
  const contas = useContasFixas();
  const mes = mesRota && /^\d{4}-\d{2}$/.test(mesRota) ? mesRota : hojeMes();
  const doMesL = useMemo(() => doMes(lancs, mes), [lancs, mes]);
  const r = useMemo(() => resumo(doMesL), [doMesL]);
  const venc = useMemo(() => vencimentos(contas, lancs, mes), [contas, lancs, mes]);
  const aPagar = venc.filter((v) => !v.paga);
  const [sheet, setSheet] = useState<null | 'entrada' | 'saida' | 'relatorio' | 'pix'>(null);
  const [editar, setEditar] = useState<Lancamento | null>(null);
  const [pagar, setPagar] = useState<Vencimento | null>(null);
  const atual = mes === hojeMes();
  const pctSaiu = r.entrou > 0 ? Math.min(100, Math.round(((r.saiu + r.taxas) / r.entrou) * 100)) : r.saiu > 0 ? 100 : 0;

  return (
    <section className="stack">
      <TopBar eyebrow="Entradas e saídas" title="Financeiro" right={<button className="icon-btn red" aria-label="Novo lançamento" onClick={() => setSheet('saida')}><Icon name="plus" /></button>} />

      <div className="mes-nav">
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => go(`financeiro/mes/${somarMes(mes, -1)}`)}><Icon name="back" /></button>
        <b>{nomeMesAno(mes)}</b>
        <button className="icon-btn" aria-label="Próximo mês" disabled={atual} onClick={() => go(`financeiro/mes/${somarMes(mes, 1)}`)}><Icon name="chev" /></button>
      </div>

      <div className="card hero">
        <div><div className="lbl">Sobrou {atual ? 'até agora' : 'no mês'}</div><div className="big" style={{ color: r.sobrou < 0 ? 'var(--red)' : undefined }}>{brl(r.sobrou)}</div></div>
        <div className="bar" aria-hidden="true"><span style={{ width: `${100 - pctSaiu}%`, background: 'var(--ok)' }} /><span style={{ width: `${pctSaiu}%`, background: 'var(--red)' }} /></div>
        <div className="split">
          <div><div className="k"><i className="dot" style={{ background: 'var(--ok)' }} />Entrou</div><div className="n">{brl(r.entrou)}</div></div>
          <div><div className="k"><i className="dot" style={{ background: 'var(--red)' }} />Saiu</div><div className="n">{brl(r.saiu)}</div></div>
        </div>
        {r.taxas > 0 && <div className="small muted">Taxas da maquininha: {brl(r.taxas)} (já descontadas do que sobrou)</div>}
      </div>

      <div className="quick">
        <button onClick={() => setSheet('entrada')}><Icon name="download" />Entrada</button>
        <button onClick={() => setSheet('saida')}><Icon name="upload" />Saída</button>
        <button onClick={() => setSheet('relatorio')}><Icon name="doc" />Relatório</button>
      </div>
      <button className="btn block ghost" style={{ marginTop: -6 }} onClick={() => setSheet('pix')}><Icon name="cash" />Cobrar no Pix (venda avulsa)</button>

      <div className="h2"><h2>Contas a pagar</h2><a className="link" href="#/financeiro/contas">Contas fixas</a></div>
      {!contas.length ? (
        <button className="card empty" style={{ width: '100%', font: 'inherit', color: 'inherit' }} onClick={() => go('financeiro/contas')}>
          <div className="ic red"><Icon name="clock" /></div>
          <b>Cadastre as contas fixas</b>
          <p>Aluguel do barracão e da máquina, DAS, internet, a retirada de toda sexta… Elas aparecem aqui todo mês.</p>
        </button>
      ) : !aPagar.length ? (
        <div className="card row"><div className="ic ok"><Icon name="check" /></div><div className="main"><div className="t">Tudo pago {atual ? 'por enquanto' : 'neste mês'}</div></div></div>
      ) : (
        <div className="card list">
          {aPagar.map((v) => (
            <div key={v.conta.id + v.data} className="row">
              <div className={`ic ${v.atrasada ? 'red' : v.data <= hojeISO() ? 'warn' : 'mute'}`}><Icon name="clock" /></div>
              <div className="main"><div className="t">{v.conta.descricao}</div><div className="s" style={{ color: v.atrasada ? 'var(--red)' : undefined }}>{v.atrasada ? 'Atrasada · ' : 'Vence '}{fmtData(v.data)} · {brl(v.conta.valor)}</div></div>
              <button className="btn" onClick={() => setPagar(v)}>Pagar</button>
            </div>
          ))}
        </div>
      )}

      <Grafico lancs={lancs} mes={mes} />

      {r.porCategoria.length > 0 && (
        <>
          <div className="h2"><h2>Para onde foi o dinheiro</h2></div>
          <div className="card list">
            {r.porCategoria.map((c) => (
              <div key={c.categoria} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div className="hrow between"><span className="t" style={{ fontWeight: 600 }}>{c.categoria}</span><span className="v num" style={{ fontFamily: 'var(--f-display)', fontWeight: 650 }}>{brl(c.valor)}</span></div>
                <div className="bar"><span style={{ width: `${Math.max(2, (c.valor / r.porCategoria[0].valor) * 100)}%`, background: c.categoria === 'Retirada do Pedro' ? 'var(--info)' : 'var(--red)' }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h2"><h2>Lançamentos</h2><span className="small faint">{doMesL.length}</span></div>
      {!doMesL.length ? (
        <Empty icon="cash" title="Nada lançado neste mês" text="Os pagamentos dos orçamentos entram sozinhos. Saídas e outras entradas você lança no botão +." />
      ) : (
        <div className="card list">
          {doMesL.map((l) => (
            <button key={l.id} className="row" onClick={() => setEditar(l)}>
              <div className={`ic ${l.tipo === 'entrada' ? 'ok' : 'mute'}`}><Icon name={l.tipo === 'entrada' ? 'download' : 'upload'} /></div>
              <div className="main"><div className="t">{l.descricao || l.categoria}</div><div className="s">{fmtDataCurta(l.data)} · {l.categoria} · {l.forma}{l.conta ? ` · ${l.conta}` : ''}</div></div>
              <div className="v" style={{ color: l.tipo === 'entrada' ? 'var(--ok)' : undefined }}>
                {l.tipo === 'entrada' ? '+ ' : '− '}{brl(l.valor)}
                {l.taxa ? <small>caiu {brl(liquido(l))}</small> : null}
              </div>
            </button>
          ))}
        </div>
      )}
      <a className="btn block ghost" href={`#/financeiro/ano/${mes.slice(0, 4)}`}><Icon name="doc" />Ver o ano de {mes.slice(0, 4)}</a>

      {(sheet === 'entrada' || sheet === 'saida') && <LancamentoSheet tipo={sheet} onClose={() => setSheet(null)} />}
      {editar && <LancamentoSheet tipo={editar.tipo} existente={editar} onClose={() => setEditar(null)} />}
      {pagar && <PagarSheet v={pagar} onClose={() => setPagar(null)} />}
      {sheet === 'pix' && <PixSheet valorInicial={0} onClose={() => setSheet(null)} />}
      {sheet === 'relatorio' && <RelatorioSheet tipo="mes" chave={mes} onClose={() => setSheet(null)} />}
    </section>
  );
}

function Grafico({ lancs, mes }: { lancs: Lancamento[]; mes: string }) {
  const meses = Array.from({ length: 6 }, (_, i) => somarMes(mes, i - 5));
  const dados = meses.map((m) => ({ m, ...resumo(doMes(lancs, m)) }));
  const max = Math.max(1, ...dados.map((d) => Math.max(d.entrou, d.saiu)));
  if (!dados.some((d) => d.entrou || d.saiu)) return null;
  const Wd = 340, Hd = 150, L = 36, B = 22, T = 8;
  const passo = max > 20000 ? 10000 : max > 8000 ? 5000 : max > 2000 ? 1000 : max > 500 ? 250 : 100;
  const topo = Math.ceil(max / passo) * passo;
  const sy = (v: number) => T + (Hd - T - B) * (1 - v / topo);
  const linhas = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const gw = (Wd - L) / 6;
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const k = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(v));
  return (
    <div className="card chart">
      <div className="hrow between" style={{ padding: '0 4px 8px' }}>
        <b style={{ fontFamily: 'var(--f-display)' }}>Últimos 6 meses</b>
        <span className="legend"><span><i style={{ background: 'var(--ok)' }} />Entrou</span><span><i style={{ background: 'var(--red)' }} />Saiu</span></span>
      </div>
      <svg viewBox={`0 0 ${Wd} ${Hd}`} role="img" aria-label="Entradas e saídas por mês">
        {linhas.map((v) => (
          <g key={v}>
            <line x1={L} x2={Wd} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 5} y={sy(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--fg-3)">{k(v)}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = L + i * gw + gw / 2;
          const ult = i === 5;
          return (
            <g key={d.m}>
              <rect x={x - 13} y={sy(d.entrou)} width={11} height={Math.max(0, sy(0) - sy(d.entrou))} rx={2.5} fill="var(--ok)" opacity={ult ? 1 : 0.55} />
              <rect x={x + 2} y={sy(d.saiu)} width={11} height={Math.max(0, sy(0) - sy(d.saiu))} rx={2.5} fill="var(--red)" opacity={ult ? 1 : 0.55} />
              <text x={x} y={Hd - 6} textAnchor="middle" fontSize="10.5" fill={ult ? 'var(--fg)' : 'var(--fg-3)'} fontWeight={ult ? 700 : 500}>{nomes[Number(d.m.slice(5)) - 1]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ======================= LANÇAR / EDITAR =======================
function LancamentoSheet({ tipo: tipoInicial, existente, onClose }: { tipo: 'entrada' | 'saida'; existente?: Lancamento; onClose: () => void }) {
  const toast = useToast();
  const cfg = useConfig();
  const [tipo, setTipo] = useState(tipoInicial);
  const [valor, setValor] = useState<number | null>(existente?.valor ?? null);
  const [data, setData] = useState(existente?.data ?? hojeISO());
  const [descricao, setDescricao] = useState(existente?.descricao ?? '');
  const [categoria, setCategoria] = useState(existente?.categoria ?? (tipoInicial === 'entrada' ? 'Venda no balcão' : ''));
  const [forma, setForma] = useState(existente?.forma ?? 'Pix');
  const [conta, setConta] = useState(existente?.conta ?? 'Sicoob');
  const [apagar, setApagar] = useState(false);
  const doOrcamento = !!existente?.orcamentoId;
  const cats = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  const ok = (valor ?? 0) > 0 && !!categoria && !!data;

  const salvar = async () => {
    const pct = tipo === 'entrada' ? (forma === 'Cartão de crédito' ? cfg.taxaCredito : forma === 'Cartão de débito' ? cfg.taxaDebito : 0) : 0;
    const l: Lancamento = {
      ...(existente ?? { id: uid(), criadoEm: new Date().toISOString() }),
      tipo, valor: valor ?? 0, data, descricao: descricao.trim(), categoria, forma, conta,
      taxa: pct ? Math.round((valor ?? 0) * pct) / 100 : undefined,
    };
    await db.lancamentos.put(l);
    toast(`Anotado: ${tipo === 'entrada' ? 'entrada' : 'saída'} de ${brl(l.valor)} em ${fmtDataCurta(l.data)}${l.descricao ? `, ${l.descricao}` : ''}, ${l.forma}.`);
    onClose();
  };

  if (doOrcamento && existente) {
    return (
      <Sheet open onClose={onClose} title="Pagamento de orçamento">
        <div className="card list">
          <div className="kv"><span className="k">Valor</span><span className="v">{brl(existente.valor)}</span></div>
          {existente.taxa ? <div className="kv"><span className="k">Caiu na conta</span><span className="v">{brl(liquido(existente))}</span></div> : null}
          <div className="kv"><span className="k">Data</span><span>{fmtData(existente.data)}</span></div>
          <div className="kv"><span className="k">Forma</span><span>{existente.forma} · {existente.conta}</span></div>
        </div>
        <p className="hint" style={{ margin: 0 }}>Esse lançamento veio de um orçamento. Para mudar ou apagar, abra o orçamento.</p>
        <button className="btn block primary" onClick={() => { onClose(); go(`orcamento/${existente.orcamentoId}`); }}><Icon name="doc" />Abrir o orçamento</button>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={existente ? 'Editar lançamento' : tipo === 'entrada' ? 'Nova entrada' : 'Nova saída'}>
      {!existente && <Seg label="Tipo" value={tipo} onChange={(t) => { setTipo(t); setCategoria(t === 'entrada' ? 'Venda no balcão' : ''); }} options={[{ value: 'saida', label: 'Saída (gastei)' }, { value: 'entrada', label: 'Entrada (recebi)' }]} />}
      <div className="field"><label htmlFor="l-v">Valor</label><MoneyInput id="l-v" value={valor} onChange={setValor} allowEmpty autoFocus={!existente} /></div>
      <div className="field"><span className="label">Categoria</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{cats.map((c) => <button key={c} className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}</div>
      </div>
      <div className="field"><label htmlFor="l-d">{tipo === 'entrada' ? 'De quem / o quê' : 'Para quem / o quê'} <span className="faint">(opcional)</span></label><input id="l-d" className="input" autoCapitalize="sentences" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: calheiro Marquinhos, material' : 'Ex.: posto Shell, Miguel, Galvisa'} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="l-dt">Data</label><input id="l-dt" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
        <div className="field"><label htmlFor="l-c">Conta</label><select id="l-c" className="input" value={conta} onChange={(e) => setConta(e.target.value)}>{CONTAS.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><span className="label">Forma</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{FORMAS_PAGAMENTO.map((f) => <button key={f} className="chip" aria-pressed={forma === f} onClick={() => { setForma(f); setConta(contaPadrao(f)); }}>{f}</button>)}</div>
      </div>
      <button className="btn block primary" disabled={!ok} onClick={salvar}><Icon name="check" />{existente ? 'Salvar' : `Lançar ${valor ? brl(valor) : ''}`}</button>
      {!categoria && (valor ?? 0) > 0 && <span className="hint" style={{ textAlign: 'center' }}>Escolha a categoria.</span>}
      {existente && <button className="btn block danger" onClick={() => setApagar(true)}><Icon name="trash" />Apagar lançamento</button>}
      <Confirm open={apagar} onClose={() => setApagar(false)} title="Apagar este lançamento?" text="Não dá para desfazer." confirmLabel="Apagar" danger onConfirm={async () => { await db.lancamentos.delete(existente!.id); toast('Lançamento apagado'); onClose(); }} />
    </Sheet>
  );
}

function PagarSheet({ v, onClose }: { v: Vencimento; onClose: () => void }) {
  const toast = useToast();
  const [valor, setValor] = useState<number | null>(v.conta.valor || null);
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState('Pix');
  const [conta, setConta] = useState('Sicoob');
  return (
    <Sheet open onClose={onClose} title={`Pagar ${v.conta.descricao}`}>
      <p className="muted" style={{ margin: 0 }}>Vencimento: {fmtData(v.data)}</p>
      <div className="field"><label htmlFor="pg-v">Valor pago</label><MoneyInput id="pg-v" value={valor} onChange={setValor} allowEmpty autoFocus /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="pg-d">Pago em</label><input id="pg-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
        <div className="field"><label htmlFor="pg-c">Saiu da conta</label><select id="pg-c" className="input" value={conta} onChange={(e) => setConta(e.target.value)}>{CONTAS.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{FORMAS_PAGAMENTO.map((f) => <button key={f} className="chip" aria-pressed={forma === f} onClick={() => { setForma(f); setConta(contaPadrao(f)); }}>{f}</button>)}</div>
      <button className="btn block primary" disabled={!(valor && valor > 0)} onClick={async () => {
        await db.lancamentos.add({ id: uid(), tipo: 'saida', data, valor: valor ?? 0, descricao: v.conta.descricao, categoria: v.conta.categoria, forma, conta, contaFixaId: v.conta.id, referencia: v.data, criadoEm: new Date().toISOString() });
        toast(`Anotado: ${v.conta.descricao} pago, ${brl(valor ?? 0)}`);
        onClose();
      }}><Icon name="check" />Marcar como pago</button>
    </Sheet>
  );
}

// ======================= CONTAS FIXAS =======================
export function ContasFixas() {
  const contas = useContasFixas();
  const cfg = useConfig();
  const [edit, setEdit] = useState<ContaFixa | 'nova' | null>(null);
  const ordenadas = [...contas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.descricao.localeCompare(b.descricao));
  const quando = (c: ContaFixa) => c.repete === 'mensal' ? `Todo dia ${c.dia}` : c.repete === 'semanal' ? `Toda ${DIAS_SEMANA[c.dia]}` : `Vence ${fmtData(c.vencimento)}`;
  return (
    <section className="stack">
      <TopBar onBack={() => go('financeiro')} backLabel="Financeiro" title="Contas fixas" right={<button className="icon-btn red" aria-label="Nova conta" onClick={() => setEdit('nova')}><Icon name="plus" /></button>} />
      {!contas.length ? (
        <Empty icon="clock" title="Nenhuma conta cadastrada" text="Ex.: aluguel do barracão (todo dia 10), DAS, internet, retirada de R$ 500 toda sexta, ou um boleto com data." action={<button className="btn primary" onClick={() => setEdit('nova')}><Icon name="plus" />Cadastrar conta</button>} />
      ) : (
        <div className="card list">
          {ordenadas.map((c) => (
            <button key={c.id} className="row" onClick={() => setEdit(c)} style={{ opacity: c.ativa ? 1 : 0.55 }}>
              <div className="ic mute"><Icon name="clock" /></div>
              <div className="main"><div className="t">{c.descricao}</div><div className="s">{quando(c)} · {c.categoria}{!c.ativa ? ' · pausada' : ''}</div></div>
              <div className="v">{brl(c.valor)}</div>
            </button>
          ))}
        </div>
      )}

      <div className="h2"><h2>Maquininha (InfinitePay)</h2></div>
      <div className="card list">
        <div className="kv" style={{ alignItems: 'center' }}><label className="k" htmlFor="tx-c">Taxa no crédito (%)</label><TaxaInput id="tx-c" value={cfg.taxaCredito} onChange={(taxaCredito) => setConfig({ taxaCredito })} /></div>
        <div className="kv" style={{ alignItems: 'center' }}><label className="k" htmlFor="tx-d">Taxa no débito (%)</label><TaxaInput id="tx-d" value={cfg.taxaDebito} onChange={(taxaDebito) => setConfig({ taxaDebito })} /></div>
      </div>
      <p className="hint" style={{ margin: '-8px 2px 0' }}>As entradas no cartão mostram quanto caiu de verdade. Vale para os próximos pagamentos.</p>
      {edit && <ContaSheet conta={edit === 'nova' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function TaxaInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  const [t, setT] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => setT(value ? String(value).replace('.', ',') : ''), [value]);
  return <input id={id} className="input money num" inputMode="decimal" style={{ width: 110, textAlign: 'right', minHeight: 40, padding: '8px 10px' }} placeholder="0" value={t} onChange={(e) => setT(e.target.value.replace(/[^\d,.]/g, ''))} onBlur={() => onChange(Math.min(30, Math.max(0, parseDecimal(t))))} />;
}

function ContaSheet({ conta, onClose }: { conta: ContaFixa | null; onClose: () => void }) {
  const toast = useToast();
  const [c, setC] = useState<ContaFixa>(conta ?? { id: uid(), descricao: '', categoria: 'Aluguel', valor: 0, repete: 'mensal', dia: 10, vencimento: null, ativa: true, criadoEm: new Date().toISOString() });
  const [apagar, setApagar] = useState(false);
  const set = (p: Partial<ContaFixa>) => setC((x) => ({ ...x, ...p }));
  const ok = c.descricao.trim() && (c.repete !== 'unica' || c.vencimento);
  return (
    <Sheet open onClose={onClose} title={conta ? 'Editar conta' : 'Nova conta'}>
      <div className="field"><label htmlFor="cf-d">Nome</label><input id="cf-d" className="input" autoCapitalize="sentences" value={c.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: Aluguel do barracão" autoFocus={!conta} /></div>
      <div className="field"><label htmlFor="cf-v">Valor</label><MoneyInput id="cf-v" value={c.valor} onChange={(v) => set({ valor: v ?? 0 })} /><span className="hint">Se muda todo mês (luz, água), coloque um valor aproximado. Na hora de pagar você acerta.</span></div>
      <Seg label="Repete" value={c.repete} onChange={(repete) => set({ repete, dia: repete === 'semanal' ? 5 : repete === 'mensal' ? 10 : c.dia, vencimento: repete === 'unica' ? c.vencimento ?? hojeISO() : null })} options={[{ value: 'mensal', label: 'Todo mês' }, { value: 'semanal', label: 'Toda semana' }, { value: 'unica', label: 'Uma vez' }]} />
      {c.repete === 'mensal' && <div className="field"><label htmlFor="cf-dia">Vence todo dia</label><select id="cf-dia" className="input" value={c.dia} onChange={(e) => set({ dia: Number(e.target.value) })}>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select></div>}
      {c.repete === 'semanal' && <div className="field"><label htmlFor="cf-sem">Toda</label><select id="cf-sem" className="input" value={c.dia} onChange={(e) => set({ dia: Number(e.target.value) })}>{DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>}
      {c.repete === 'unica' && <div className="field"><label htmlFor="cf-venc">Vencimento</label><input id="cf-venc" type="date" className="input" value={c.vencimento ?? ''} onChange={(e) => set({ vencimento: e.target.value || null })} /></div>}
      <div className="field"><span className="label">Categoria</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{CATEGORIAS_SAIDA.map((k) => <button key={k} className="chip" aria-pressed={c.categoria === k} onClick={() => set({ categoria: k })}>{k}</button>)}</div>
      </div>
      {conta && c.repete !== 'unica' && <Seg label="Situação" value={c.ativa ? 's' : 'n'} onChange={(x) => set({ ativa: x === 's' })} options={[{ value: 's', label: 'Ativa' }, { value: 'n', label: 'Pausada' }]} />}
      <button className="btn block primary" disabled={!ok} onClick={async () => { await db.contasFixas.put({ ...c, descricao: c.descricao.trim() }); toast(conta ? 'Conta salva' : 'Conta cadastrada'); onClose(); }}><Icon name="check" />{conta ? 'Salvar' : 'Cadastrar'}</button>
      {conta && <button className="btn block danger" onClick={() => setApagar(true)}><Icon name="trash" />Apagar conta</button>}
      <Confirm open={apagar} onClose={() => setApagar(false)} title={`Apagar ${c.descricao}?`} text="Os pagamentos já feitos continuam no financeiro." confirmLabel="Apagar" danger onConfirm={async () => { await db.contasFixas.delete(c.id); toast('Conta apagada'); onClose(); }} />
    </Sheet>
  );
}

// ======================= ANO =======================
export function FinanceiroAno({ ano: anoRota }: { ano?: string }) {
  const lancs = useLancamentos();
  const ano = Number(anoRota) || new Date().getFullYear();
  const [relatorio, setRelatorio] = useState(false);
  const doAno = lancs.filter((l) => l.data.startsWith(String(ano)));
  const r = resumo(doAno);
  const meses = Array.from({ length: 12 }, (_, i) => somarMes(`${ano}-01`, i)).filter((m) => m <= hojeMes() && (m === hojeMes() || doAno.some((l) => l.data.startsWith(m))));
  return (
    <section className="stack">
      <TopBar onBack={() => go('financeiro')} backLabel="Financeiro" title={`Ano de ${ano}`} right={<button className="icon-btn" aria-label="Relatório do ano em PDF" onClick={() => setRelatorio(true)}><Icon name="doc" /></button>} />
      <div className="card hero">
        <div><div className="lbl">Sobrou no ano</div><div className="big" style={{ color: r.sobrou < 0 ? 'var(--red)' : undefined }}>{brl(r.sobrou)}</div></div>
        <div className="split">
          <div><div className="k">Entrou</div><div className="n">{brl(r.entrou)}</div></div>
          <div><div className="k">Saiu</div><div className="n">{brl(r.saiu)}</div></div>
        </div>
      </div>
      <div className="card list">
        {[...meses].reverse().map((m) => {
          const x = resumo(doMes(doAno, m));
          return (
            <a key={m} className="row" href={`#/financeiro/mes/${m}`}>
              <div className="main"><div className="t" style={{ textTransform: 'capitalize' }}>{nomeMesAno(m).split(' ')[0]}</div><div className="s num">Entrou {brl(x.entrou)} · Saiu {brl(x.saiu)}</div></div>
              <div className="v" style={{ color: x.sobrou < 0 ? 'var(--red)' : undefined }}>{brl(x.sobrou)}<small>sobrou</small></div>
            </a>
          );
        })}
      </div>
      <button className="btn block primary" onClick={() => setRelatorio(true)}><Icon name="doc" />Relatório do ano em PDF</button>
      <div className="hrow between">
        <a className="btn ghost" href={`#/financeiro/ano/${ano - 1}`}><Icon name="back" />{ano - 1}</a>
        {ano < new Date().getFullYear() && <a className="btn ghost" href={`#/financeiro/ano/${ano + 1}`}>{ano + 1}<Icon name="chev" /></a>}
      </div>
      {relatorio && <RelatorioSheet tipo="ano" chave={String(ano)} onClose={() => setRelatorio(false)} />}
    </section>
  );
}

// ======================= RELATÓRIO PDF =======================
function RelatorioSheet({ tipo, chave, onClose }: { tipo: 'mes' | 'ano'; chave: string; onClose: () => void }) {
  const lancs = useLancamentos();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    Promise.all([import('../lib/pdf'), import('../lib/relatorio')])
      .then(async ([pdf, rel]) => {
        const a = await pdf.carregarAssets();
        if (!vivo) return;
        const f = tipo === 'mes' ? rel.relatorioMes(lancs, chave, a) : rel.relatorioAno(lancs, Number(chave), a);
        setFile(f);
        setUrl(URL.createObjectURL(f));
      })
      .catch(() => vivo && setErro('Não consegui montar o relatório. Confira a internet e tente de novo.'));
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <Sheet open onClose={onClose} title={tipo === 'mes' ? `Relatório de ${nomeMesAno(chave)}` : `Relatório de ${chave}`}>
      {erro ? <p className="err">{erro}</p> : !file ? <p className="muted">Montando o relatório…</p> : (
        <>
          <div className="card" style={{ overflow: 'hidden', aspectRatio: '595 / 842', maxWidth: '100%', background: '#fff' }}>
            <iframe title="Prévia do relatório" src={url + '#toolbar=0&view=FitH'} style={{ width: '100%', height: '100%', border: 0 }} />
          </div>
          <button className="btn block primary" onClick={async () => { const r = await compartilharArquivo(file); if (r !== 'cancelado') { toast(r === 'ok' ? 'Relatório enviado' : 'Relatório baixado'); onClose(); } }}><Icon name="share" />Salvar ou enviar</button>
          <a className="btn block" href={url} target="_blank" rel="noreferrer"><Icon name="doc" />Abrir em tela cheia</a>
        </>
      )}
    </Sheet>
  );
}
