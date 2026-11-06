import { useState } from 'react';
import { db, type Adiantamento, type Calheiro } from '../lib/db';
import { go, replace } from '../lib/router';
import { useAdiantamentos, useConfig, useOrcamentos, useRegistro, useCalheiros } from '../lib/hooks';
import { CATALOGO } from '../lib/catalog';
import { chaveItem, plural, saldos, type Sugestao } from '../lib/adiantamento';
import { calcular, statusVisual } from '../lib/calc';
import { brl, fmtData, hojeISO, maskPhone, qtd, telLink, uid, waLink } from '../lib/format';
import { Confirm, DecimalInput, Empty, Icon, PhoneInput, Pill, Seg, Sheet, TopBar, useToast } from '../components/ui';

/** Materiais que costumam ir adiantados no carro. */
const MATERIAIS = CATALOGO.filter((c) => c.grupo === 'Acessórios' || c.grupo === 'Condutores');

export function CalheiroTela({ id }: { id: string }) {
  const c = useRegistro(useCalheiros(), db.calheiros, id);
  if (c === undefined) return null;
  if (!c) return <Empty icon="helmet" title="Calheiro não encontrado" action={<button className="btn" onClick={() => go('mais/calheiros')}>Voltar</button>} />;
  return <Detalhe c={c} />;
}

function Detalhe({ c }: { c: Calheiro }) {
  const movs = useAdiantamentos();
  const orcs = useOrcamentos();
  const cfg = useConfig();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | 'pegou' | 'editar' | 'apagar'>(null);
  const [apagarMov, setApagarMov] = useState<Adiantamento | null>(null);
  const meus = movs.filter((m) => m.calheiroId === c.id).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
  const sal = saldos(movs, c.id);
  const servicos = orcs.filter((o) => o.calheiroIds.includes(c.id) && !o.juntadoNo);

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais/calheiros')} backLabel="Calheiros" eyebrow={c.ativo ? 'Calheiro' : 'Calheiro · inativo'} title={c.nome}
        right={<button className="icon-btn" aria-label="Editar" onClick={() => setSheet('editar')}><Icon name="edit" /></button>} />

      {c.telefone && (
        <div className="quick" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <a href={waLink(c.telefone)} target="_blank" rel="noreferrer"><Icon name="wa" />WhatsApp</a>
          <a href={telLink(c.telefone)}><Icon name="phone" />Ligar</a>
        </div>
      )}

      <div className="h2"><h2>Material adiantado</h2><span className="small faint">fica com ele no carro</span></div>
      <div className="card list">
        {sal.length ? sal.map((s) => (
          <div key={s.chave} className="row">
            <div className="q-box"><b>{qtd(s.saldo)}</b><small>com ele</small></div>
            <div className="main"><div className="t">{s.descricao}</div><div className="s">Desconta nos próximos orçamentos dele</div></div>
          </div>
        )) : <div className="row"><span className="muted">Nada adiantado com ele agora.</span></div>}
        <div className="row"><button className="btn block primary" onClick={() => setSheet('pegou')}><Icon name="plus" />{c.nome.split(' ')[0]} pegou material</button></div>
      </div>
      <p className="hint" style={{ margin: '-8px 2px 0' }}>O cliente continua pagando o material no orçamento. Isso aqui só controla o que já está com o calheiro, para não entregar de novo.</p>

      {meus.length > 0 && (
        <>
          <div className="h2"><h2>Histórico do material</h2></div>
          <div className="card list">
            {meus.map((m) => {
              const o = m.orcamentoId ? orcs.find((x) => x.id === m.orcamentoId) : null;
              return (
                <div key={m.id} className="row">
                  <div className={`ic ${m.quantidade > 0 ? 'info' : 'ok'}`}><Icon name={m.quantidade > 0 ? 'download' : 'check'} /></div>
                  <div className="main">
                    <div className="t">{m.quantidade > 0 ? `Pegou ${plural(m.quantidade, m.descricao)}` : `Descontou ${plural(-m.quantidade, m.descricao)}`}</div>
                    <div className="s">{fmtData(m.data)}{o ? ` · orçamento nº ${o.numero} (${o.clienteNome})` : m.orcamentoId ? ' · orçamento apagado' : ''}</div>
                  </div>
                  <button className="icon-btn" style={{ border: 0, background: 'none' }} aria-label="Apagar" onClick={() => setApagarMov(m)}><Icon name="trash" style={{ width: 18, height: 18, color: 'var(--fg-3)' }} /></button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {servicos.length > 0 && (
        <>
          <div className="h2"><h2>Serviços</h2><span className="small faint">{servicos.length}</span></div>
          <div className="card list">
            {servicos.slice(0, 15).map((o) => {
              const t = calcular(o, cfg).total;
              const st = statusVisual(o, t);
              return (
                <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
                  <div className="main"><div className="t">{o.clienteNome || 'Sem cliente'}</div><div className="s num">Nº {o.numero} · {fmtData(o.emitidoEm)}</div></div>
                  <div className="v" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>{brl(t)}<Pill cor={st.cor}>{st.rotulo}</Pill></div>
                </a>
              );
            })}
          </div>
        </>
      )}

      {sheet === 'pegou' && <PegouSheet c={c} onClose={() => setSheet(null)} />}
      {sheet === 'editar' && <EditarSheet c={c} onClose={() => setSheet(null)} onApagar={() => setSheet('apagar')} />}
      <Confirm open={sheet === 'apagar'} onClose={() => setSheet(null)} title={`Apagar ${c.nome}?`} text="Nos orçamentos antigos o nome dele deixa de aparecer. Se ele só parou de trabalhar com vocês, prefira marcar como inativo." confirmLabel="Apagar" danger
        onConfirm={async () => { await db.calheiros.delete(c.id); toast('Calheiro apagado'); replace('mais/calheiros'); }} />
      <Confirm open={!!apagarMov} onClose={() => setApagarMov(null)} title="Apagar este lançamento?" text="O saldo de material dele é recalculado." confirmLabel="Apagar" danger
        onConfirm={async () => { if (apagarMov) { await db.adiantamentos.delete(apagarMov.id); toast('Apagado'); } }} />
    </section>
  );
}

function PegouSheet({ c, onClose }: { c: Calheiro; onClose: () => void }) {
  const toast = useToast();
  const [chave, setChave] = useState('silicone');
  const [outro, setOutro] = useState('');
  const [quant, setQuant] = useState(1);
  const [data, setData] = useState(hojeISO());
  const livre = chave === 'outro';
  const descricao = livre ? outro.trim() : MATERIAIS.find((m) => m.key === chave)?.descricao ?? '';
  return (
    <Sheet open onClose={onClose} title={`${c.nome.split(' ')[0]} pegou`}>
      <div className="field"><span className="label">Material</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {MATERIAIS.map((m) => <button key={m.key} className="chip" aria-pressed={chave === m.key} onClick={() => setChave(m.key)}>{m.chip}</button>)}
          <button className="chip" aria-pressed={livre} onClick={() => setChave('outro')}>Outro</button>
        </div>
      </div>
      {livre && <div className="field"><label htmlFor="pg-o">Qual material?</label><input id="pg-o" className="input" value={outro} onChange={(e) => setOutro(e.target.value)} autoFocus placeholder="Ex.: Arrebite de alumínio" /></div>}
      <div className="grid2">
        <div className="field"><label htmlFor="pg-q">Quantidade</label><DecimalInput id="pg-q" value={quant} onChange={setQuant} className="money" /></div>
        <div className="field"><label htmlFor="pg-d">Data</label><input id="pg-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
      </div>
      <button className="btn block primary" disabled={!descricao || quant <= 0} onClick={async () => {
        await db.adiantamentos.add({ id: uid(), calheiroId: c.id, chave: livre ? chaveItem({ descricao, catalogo: undefined }) : chave, descricao, quantidade: quant, data, orcamentoId: null, criadoEm: new Date().toISOString() });
        toast(`Anotado: ${c.nome.split(' ')[0]} pegou ${plural(quant, descricao)}`);
        onClose();
      }}><Icon name="check" />Anotar</button>
    </Sheet>
  );
}

function EditarSheet({ c, onClose, onApagar }: { c: Calheiro; onClose: () => void; onApagar: () => void }) {
  const [nome, setNome] = useState(c.nome);
  const [tel, setTel] = useState(maskPhone(c.telefone));
  const [ativo, setAtivo] = useState(c.ativo);
  return (
    <Sheet open onClose={onClose} title="Editar calheiro">
      <div className="field"><label htmlFor="ce-n">Nome</label><input id="ce-n" className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="field"><label htmlFor="ce-t">Telefone</label><PhoneInput id="ce-t" value={tel} onChange={setTel} /></div>
      <Seg label="Situação" value={ativo ? 's' : 'n'} onChange={(v) => setAtivo(v === 's')} options={[{ value: 's', label: 'Ativo' }, { value: 'n', label: 'Inativo' }]} />
      <button className="btn block primary" disabled={!nome.trim()} onClick={async () => { await db.calheiros.update(c.id, { nome: nome.trim(), telefone: tel, ativo }); onClose(); }}><Icon name="check" />Salvar</button>
      <button className="btn block danger" onClick={onApagar}><Icon name="trash" />Apagar calheiro</button>
    </Sheet>
  );
}

/** Quadro dentro do orçamento: descontar do material que o calheiro já levou. */
export function DescontoMaterial({ sugestoes, calheiros, orcamentoId }: { sugestoes: Sugestao[]; calheiros: Calheiro[]; orcamentoId: string }) {
  const movs = useAdiantamentos();
  const toast = useToast();
  const [editar, setEditar] = useState<Sugestao | null>(null);
  if (!sugestoes.length) return null;
  const desfazer = async (s: Sugestao) => {
    const ids = movs.filter((m) => m.calheiroId === s.calheiroId && m.orcamentoId === orcamentoId && m.chave === s.chave).map((m) => m.id);
    await db.adiantamentos.bulkDelete(ids);
    toast('Desconto desfeito');
  };
  return (
    <div className="card list" style={{ borderColor: 'var(--info)' }}>
      {sugestoes.map((s) => {
        const nome = calheiros.find((c) => c.id === s.calheiroId)?.nome.split(' ')[0] ?? 'Calheiro';
        return (
          <div key={s.calheiroId + s.chave} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="ic info"><Icon name="helmet" /></div>
            <div className="main">
              <div className="t" style={{ whiteSpace: 'normal' }}>
                {s.jaDescontado > 0 ? `Descontado ${plural(s.jaDescontado, s.descricao)} do material do ${nome}` : `${nome} tem ${plural(s.saldo, s.descricao)} adiantado${s.saldo === 1 ? '' : 's'}`}
              </div>
              <div className="s" style={{ whiteSpace: 'normal' }}>
                {s.jaDescontado > 0 ? `Entregar só ${plural(Math.max(0, s.noOrcamento - s.jaDescontado), s.descricao)}. Ainda com ele: ${qtd(s.saldo)}.` : `O orçamento usa ${qtd(s.noOrcamento)}. O cliente continua pagando todos.`}
              </div>
            </div>
            {s.jaDescontado > 0
              ? <button className="link small" onClick={() => desfazer(s)}>Desfazer</button>
              : s.sugerido > 0 && <button className="btn" onClick={() => setEditar(s)}>Descontar</button>}
          </div>
        );
      })}
      {editar && <DescontarSheet s={editar} nome={calheiros.find((c) => c.id === editar.calheiroId)?.nome.split(' ')[0] ?? ''} orcamentoId={orcamentoId} onClose={() => setEditar(null)} />}
    </div>
  );
}

function DescontarSheet({ s, nome, orcamentoId, onClose }: { s: Sugestao; nome: string; orcamentoId: string; onClose: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState(s.sugerido);
  const ok = q > 0 && q <= s.saldo;
  return (
    <Sheet open onClose={onClose} title={`Descontar do ${nome}`}>
      <p className="muted" style={{ margin: 0 }}>Ele tem {plural(s.saldo, s.descricao)} no carro. Este orçamento usa {qtd(s.noOrcamento)}.</p>
      <div className="field"><label htmlFor="dm-q">Quantos descontar?</label><DecimalInput id="dm-q" value={q} onChange={setQ} className="money" autoFocus /></div>
      {q > s.saldo && <span className="err">Ele só tem {qtd(s.saldo)}.</span>}
      <p className="hint" style={{ margin: 0 }}>Você entrega {plural(Math.max(0, s.noOrcamento - q), s.descricao)} para ele. O valor do orçamento não muda.</p>
      <button className="btn block primary" disabled={!ok} onClick={async () => {
        await db.adiantamentos.add({ id: uid(), calheiroId: s.calheiroId, chave: s.chave, descricao: s.descricao, quantidade: -q, data: hojeISO(), orcamentoId, criadoEm: new Date().toISOString() });
        toast(`Descontado: ${plural(q, s.descricao)} do material do ${nome}`);
        onClose();
      }}><Icon name="check" />Descontar {qtd(q)}</button>
    </Sheet>
  );
}
