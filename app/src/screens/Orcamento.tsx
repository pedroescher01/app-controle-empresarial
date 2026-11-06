import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, type Calheiro, type Cliente, type Item, type Orcamento, type StatusOrc } from '../lib/db';
import { go, replace } from '../lib/router';
import { useAdiantamentos, useCalheiros, useClientes, useConfig, useOrcamentos, useRegistro } from '../lib/hooks';
import { CATALOGO, CONTAS, CORTES, FORMAS_PAGAMENTO, UNIDADES, contaPadrao, precoCatalogo, type CatalogItem } from '../lib/catalog';
import { calcular, enderecoTexto, nomeArquivo, precoMetroItem, resumoPagamentos, statusVisual, juntarNomes } from '../lib/calc';
import { addDias, brl, dec2, fmtData, hojeISO, iniciais, maskPhone, qtd, r2, semAcento, uid, waLink } from '../lib/format';
import { Confirm, DecimalInput, Empty, Icon, MoneyInput, PhoneInput, Pill, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { apagarOrcamento, apagarPagamento, registrarPagamento, separarJuncao } from './orcamentoActions';
import { compartilharArquivo } from '../lib/share';
import { novoCliente } from './Clientes';
import { DescontoMaterial } from './Calheiro';
import { sugestoes as sugestoesMaterial } from '../lib/adiantamento';

const ITEM_LIVRE: CatalogItem = { key: 'livre', descricao: '', chip: '', unidade: 'un', tipo: 'unidade', preco: 0, grupo: 'Acessórios' };

export function OrcamentoTela({ id }: { id: string }) {
  const orc = useRegistro(useOrcamentos(), db.orcamentos, id);
  if (orc === undefined) return null;
  if (!orc) return <Empty icon="doc" title="Orçamento não encontrado" action={<button className="btn" onClick={() => go('orcamentos')}>Voltar</button>} />;
  return <Editor key={orc.id} inicial={orc} />;
}

function Editor({ inicial }: { inicial: Orcamento }) {
  const cfg = useConfig();
  const calheiros = useCalheiros();
  const adiantamentos = useAdiantamentos();
  const toast = useToast();
  const [o, setO] = useState<Orcamento>(inicial);
  const ref = useRef(o);
  ref.current = o;

  // pagamentos mudam por fora do editor (folha de pagamento) → acompanha o banco
  const todos = useOrcamentos();
  const doBanco = todos.find((x) => x.id === inicial.id);
  const origens = todos.filter((x) => x.juntadoNo === inicial.id);
  useEffect(() => {
    if (doBanco && doBanco.pagamentos.length !== ref.current.pagamentos.length) setO((x) => ({ ...x, pagamentos: doBanco.pagamentos, parcelas: doBanco.parcelas, status: doBanco.status, aprovadoEm: doBanco.aprovadoEm }));
  }, [doBanco]);

  // salva sozinho (pagamentos são gravados pelas ações próprias, não aqui)
  const timer = useRef<number>();
  const apagado = useRef(false);
  const gravar = useCallback(() => {
    if (apagado.current) return;
    const { pagamentos: _p, parcelas: _n, ...resto } = ref.current;
    void _p; void _n;
    return db.orcamentos.update(resto.id, { ...resto, atualizadoEm: new Date().toISOString() });
  }, []);
  const set = useCallback((p: Partial<Orcamento>) => {
    setO((x) => ({ ...x, ...p }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(gravar, 350);
  }, [gravar]);

  // ao sair: grava o que faltou; apaga se ficou totalmente vazio
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    const a = ref.current;
    if (apagado.current) return;
    if (!a.clienteNome.trim() && !a.itens.length && !a.pagamentos.length) db.orcamentos.delete(a.id);
    else gravar();
  }, [gravar]);

  const r = useMemo(() => calcular(o, cfg), [o, cfg]);
  const pag = resumoPagamentos(o, r.total);
  const st = statusVisual(o, r.total);

  const [sheet, setSheet] = useState<null | 'cliente' | 'item' | 'pagamento' | 'pdf' | 'apagar' | 'calheiro' | 'add' | 'separar'>(null);
  const [itemEdit, setItemEdit] = useState<Item | null>(null);
  const fechar = useCallback(() => setSheet(null), []);

  const addItem = (c: CatalogItem) => {
    const it: Item = {
      id: uid(), tipo: c.tipo, catalogo: c.key, descricao: c.descricao, unidade: c.unidade,
      quantidade: c.tipo === 'mao' ? 1 : 0, corte: c.corte ?? null, chapa: 26,
      precoUnit: precoCatalogo(c, cfg.precos), condutor: c.condutor,
      precoManual: c.tipo === 'metro' && !c.corte ? true : undefined,
    };
    setItemEdit(it);
    setSheet('item');
  };
  const salvarItem = (it: Item) => {
    const existe = o.itens.some((x) => x.id === it.id);
    set({ itens: existe ? o.itens.map((x) => (x.id === it.id ? it : x)) : [...o.itens, it] });
    fechar();
  };
  const removerItem = (iid: string) => { set({ itens: o.itens.filter((x) => x.id !== iid) }); fechar(); };

  const nomesCal = juntarNomes(o.calheiroIds.map((cid) => calheiros.find((c) => c.id === cid)?.nome).filter(Boolean) as string[]);
  const simples = o.modo === 'simples';

  return (
    <section className="stack">
      <TopBar
        onBack={() => go('orcamentos')}
        backLabel="Orçamentos"
        eyebrow={<>Orçamento nº {o.numero} · {fmtData(o.emitidoEm)}</>}
        title={o.clienteNome || 'Novo orçamento'}
        right={<Pill cor={st.cor}>{st.rotulo}</Pill>}
      />

      {o.juntadoNo && (() => {
        const destino = todos.find((x) => x.id === o.juntadoNo);
        return (
          <div className="card row" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
            <div className="ic warn"><Icon name="copy" /></div>
            <div className="main"><div className="t" style={{ whiteSpace: 'normal' }}>Este orçamento foi juntado{destino ? ` no nº ${destino.numero}` : ''}</div><div className="s">Ele fica guardado só para consulta.</div></div>
            {destino && <a className="btn" href={`#/orcamento/${destino.id}`}>Abrir</a>}
          </div>
        );
      })()}
      {origens.length > 0 && (
        <div className="card row" style={{ background: 'var(--info-soft)', borderColor: 'transparent' }}>
          <div className="ic info"><Icon name="copy" /></div>
          <div className="main"><div className="t" style={{ whiteSpace: 'normal' }}>Junção de {origens.length} orçamentos</div><div className="s">{origens.map((x) => `nº ${x.numero}`).join(', ')}</div></div>
          {!o.pagamentos.length && <button className="btn" onClick={() => setSheet('separar')}>Separar</button>}
        </div>
      )}

      {/* cliente */}
      <button className="card row" onClick={() => setSheet('cliente')} style={{ padding: 14 }}>
        <div className="avatar">{o.clienteNome ? iniciais(o.clienteNome) : <Icon name="users" style={{ width: 20, height: 20 }} />}</div>
        <div className="main">
          <div className="t">{o.clienteNome || 'Escolher cliente'}{nomesCal && <span className="faint" style={{ fontWeight: 500 }}> · ({nomesCal})</span>}</div>
          <div className="s">{o.clienteNome ? [o.endereco || 'Sem endereço', o.telefone].filter(Boolean).join(' · ') : 'Toque para buscar ou cadastrar'}</div>
        </div>
        <Icon name="chev" className="chev" />
      </button>

      {/* calheiros */}
      <div className="stack-s">
        <div className="label" style={{ paddingLeft: 2 }}>Calheiro que vai fazer</div>
        <div className="chips">
          {calheiros.filter((c) => c.ativo || o.calheiroIds.includes(c.id)).map((c) => {
            const on = o.calheiroIds.includes(c.id);
            return <button key={c.id} className="chip" aria-pressed={on} onClick={() => set({ calheiroIds: on ? o.calheiroIds.filter((x) => x !== c.id) : [...o.calheiroIds, c.id] })}>{on && <Icon name="check" />}{c.nome}</button>;
          })}
          <button className="chip add" onClick={() => setSheet('calheiro')}><Icon name="plus" />{calheiros.length ? 'Novo' : 'Cadastrar calheiro'}</button>
        </div>
        {!o.calheiroIds.length && o.clienteNome && <span className="hint" style={{ paddingLeft: 2 }}>Sem calheiro, o PDF sai como “{o.clienteNome} - ({o.clienteNome})”.</span>}
      </div>
      <DescontoMaterial sugestoes={sugestoesMaterial(adiantamentos, o.calheiroIds, o.itens, o.id)} calheiros={calheiros} orcamentoId={o.id} />

      <Seg label="Estilo do orçamento" value={o.modo} onChange={(modo) => set({ modo })} options={[{ value: 'simples', label: 'Simples' }, { value: 'detalhado', label: 'Detalhado' }]} />
      <p className="hint" style={{ margin: '-8px 2px 0' }}>{simples ? 'No PDF vão quantidade, unidade e descrição. Só o total geral leva valor.' : 'No PDF cada linha mostra o valor unitário e o total.'}</p>

      {/* adicionar */}
      <div className="chips" aria-label="Adicionar item">
        {CATALOGO.map((c) => <button key={c.key} className="chip add" onClick={() => addItem(c)}><Icon name="plus" />{c.chip}</button>)}
        <button className="chip add" onClick={() => addItem(ITEM_LIVRE)}><Icon name="plus" />Outro item</button>
      </div>

      {/* itens */}
      {o.itens.length ? (
        <div className={`card list ${simples ? 'internal' : ''}`}>
          {r.linhas.map((l) => (
            <button key={l.item.id} className="item row" onClick={() => { setItemEdit(l.item); setSheet('item'); }}>
              <div className="q">{qtd(l.item.quantidade)}<small>{l.item.unidade}</small></div>
              <div className="d">
                <b>{l.item.descricao || 'Sem descrição'}</b>
                <small>
                  {l.item.tipo === 'metro' && l.item.corte ? <>corte {l.item.corte} · chapa {l.item.chapa ?? 26}{l.item.corte > 65 && l.item.corte < 120 ? ' (do 120)' : ''}</> : null}
                  {l.item.condutor ? <>{qtd(l.item.quantidade / 2)} barra{l.item.quantidade / 2 === 1 ? '' : 's'} de 2 m</> : null}
                  {l.item.tipo === 'mao' ? 'Serviço' : null}
                  {l.ajuste ? <span className="adj"> · {l.ajuste > 0 ? '+' : '−'} {brl(Math.abs(l.ajuste))}</span> : null}
                </small>
              </div>
              <div className="p">{brl(l.total)}<small>{simples ? 'só interno' : `${brl(l.unit)} / ${l.item.unidade}`}</small></div>
            </button>
          ))}
        </div>
      ) : (
        <button className="card empty" style={{ width: '100%', font: 'inherit', color: 'inherit' }} onClick={() => addItem(ITEM_LIVRE)}>
          <div className="ic red"><Icon name="edit" /></div>
          <b>Nenhum item</b>
          <p>Toque aqui para digitar um item, ou use os botões acima para os itens prontos.</p>
        </button>
      )}

      {o.itens.length > 0 && <button className="btn block ghost" onClick={() => addItem(ITEM_LIVRE)}><Icon name="plus" />Adicionar item</button>}

      {/* totais */}
      <div className="card list">
        <div className="kv"><span className="k">Subtotal</span><span className="v">{brl(r.subtotal)}</span></div>
        <div className="kv" style={{ alignItems: 'center' }}>
          <label className="k" htmlFor="o-desc">Desconto</label>
          <MoneyInput id="o-desc" value={o.desconto} onChange={(v) => set({ desconto: v ?? 0 })} style={{ width: 140, textAlign: 'right', minHeight: 40, padding: '8px 10px' }} />
        </div>
        <div className="kv" style={{ alignItems: 'center' }}>
          <div className="k"><label htmlFor="o-fechar">Fechar em</label><div className="hint">Diferença só nas calhas e rufos</div></div>
          <div className="hrow" style={{ gap: 6 }}>
            {o.totalDesejado != null && <button className="del icon-btn" style={{ width: 32, height: 32, border: 0 }} aria-label="Tirar o fechar em" onClick={() => set({ totalDesejado: null })}><Icon name="x" style={{ width: 16, height: 16 }} /></button>}
            <MoneyInput id="o-fechar" allowEmpty value={o.totalDesejado} onChange={(v) => set({ totalDesejado: v })} placeholder="—" style={{ width: 140, textAlign: 'right', minHeight: 40, padding: '8px 10px' }} />
          </div>
        </div>
        {r.ajusteImpossivel && <div className="kv"><span className="err">Para fechar o valor, o orçamento precisa ter calha ou rufo.</span></div>}
        <div className="kv total"><span className="k">Total</span><span className="v">{brl(r.total)}</span></div>
      </div>

      {/* detalhes */}
      <div className="card form-card">
        <div className="grid2">
          <div className="field"><label htmlFor="o-emit">Emitido em</label><input id="o-emit" type="date" className="input" value={o.emitidoEm} onChange={(e) => e.target.value && set({ emitidoEm: e.target.value })} /></div>
          <div className="field"><label htmlFor="o-val">Válido até</label><input id="o-val" type="date" className="input" value={o.validoAte ?? ''} onChange={(e) => set({ validoAte: e.target.value || null })} /></div>
        </div>
        <div className="field">
          <label htmlFor="o-vista">Valor à vista <span className="faint">(opcional)</span></label>
          <MoneyInput id="o-vista" allowEmpty value={o.valorAVista} onChange={(v) => set({ valorAVista: v })} placeholder="—" />
          {o.valorAVista ? <span className="hint">{o.pagamentos.length ? 'Já tem pagamento registrado, então essa frase não sai mais no PDF. O valor fica guardado aqui.' : <>Vai nas observações: “Em caso de pagamento à vista, o valor será {brl(o.valorAVista)}.” Sai do PDF depois do primeiro pagamento.</>}</span> : null}
        </div>
        <div className="field"><label htmlFor="o-obs">Observações</label><textarea id="o-obs" className="input" value={o.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Ex.: Valor pode ser parcelado em até 3x sem juros." /></div>
      </div>

      {/* serviço agendado */}
      <div className="card form-card">
        <h3>Serviço agendado {o.servicoData && <button className="link" onClick={() => set({ servicoData: null, servicoPeriodo: null })}>Tirar data</button>}</h3>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {[['Hoje', hojeISO()], ['Amanhã', addDias(hojeISO(), 1)]].map(([l, d]) => <button key={l} className="chip" aria-pressed={o.servicoData === d} onClick={() => set({ servicoData: o.servicoData === d ? null : d })}>{l}</button>)}
          <input type="date" className="input" aria-label="Data do serviço" value={o.servicoData ?? ''} onChange={(e) => set({ servicoData: e.target.value || null })} style={{ width: 'auto', minHeight: 38, padding: '6px 10px', fontSize: 15 }} />
        </div>
        {o.servicoData
          ? <Seg label="Período do serviço" value={o.servicoPeriodo ?? 'x'} onChange={(p) => set({ servicoPeriodo: p === 'x' ? null : (p as 'manha' | 'tarde') })} options={[{ value: 'x', label: 'Qualquer hora' }, { value: 'manha', label: 'Manhã' }, { value: 'tarde', label: 'Tarde' }]} />
          : <span className="hint">Quando combinar a instalação, coloque a data. Ela aparece na Agenda das visitas e no Início.</span>}
      </div>

      {/* situação */}
      <div className="stack-s">
        <div className="label" style={{ paddingLeft: 2 }}>Situação</div>
        <Seg<StatusOrc> label="Situação" value={o.status} onChange={(status) => set({ status, enviadoEm: status === 'enviado' && !o.enviadoEm ? hojeISO() : o.enviadoEm, aprovadoEm: status === 'aprovado' && !o.aprovadoEm ? hojeISO() : o.aprovadoEm })}
          options={[{ value: 'rascunho', label: 'Rascunho' }, { value: 'enviado', label: 'Enviado' }, { value: 'aprovado', label: 'Aprovado' }, { value: 'recusado', label: 'Recusado' }]} />
      </div>

      {/* pagamentos */}
      <div className="h2"><h2>Pagamentos</h2>{o.pagamentos.length > 0 && <span className="small faint">{o.pagamentos.length} de {Math.max(o.parcelas, o.pagamentos.length)}</span>}</div>
      <div className="card list">
        {o.pagamentos.map((p, i) => (
          <PagamentoLinha key={p.id} n={i + 1} p={p} onApagar={() => apagarPagamento(o, p.id).then(() => toast('Pagamento apagado'))} />
        ))}
        <div className="kv"><span className="k">Pago</span><span className="v">{brl(pag.pago)}</span></div>
        <div className="kv"><span className="k">Falta</span><span className="v" style={{ color: pag.saldo > 0 ? 'var(--red)' : 'var(--ok)' }}>{pag.saldo > 0 ? brl(pag.saldo) : 'Quitado'}</span></div>
        {pag.saldo > 0 && <div className="row"><button className="btn block ghost" onClick={() => setSheet('pagamento')} disabled={r.total <= 0}><Icon name="cash" />Registrar pagamento</button></div>}
      </div>

      {o.status === 'enviado' && o.telefone && (
        <a className="btn block" href={waLink(o.telefone, `Olá, ${o.clienteNome.split(' ')[0]}! Tudo bem? Aqui é da Calhas Andrade. Conseguiu ver o orçamento nº ${o.numero} que mandamos? Qualquer dúvida estou à disposição.`)} target="_blank" rel="noreferrer"><Icon name="wa" />Mandar lembrete no WhatsApp</a>
      )}

      <button className="btn block danger" onClick={() => setSheet('apagar')}><Icon name="trash" />Apagar orçamento</button>

      {/* barra do total */}
      <div className="totalbar"><div>
        <div className="grow"><div className="lbl">Total do orçamento</div><div className="val">{brl(r.total)}</div></div>
        <button className="btn primary" onClick={() => { if (!o.clienteNome.trim()) { toast('Escolha o cliente primeiro'); setSheet('cliente'); return; } setSheet('pdf'); }}><Icon name="share" />Gerar PDF</button>
      </div></div>

      <Sheet open={sheet === 'add'} onClose={fechar} title="Adicionar item">
        {(['Calhas e rufos', 'Condutores', 'Acessórios', 'Serviço'] as const).map((g) => (
          <div key={g} className="stack-s">
            <div className="label" style={{ paddingLeft: 2 }}>{g}</div>
            <div className="card list">
              {CATALOGO.filter((c) => c.grupo === g).map((c) => (
                <button key={c.key} className="row" onClick={() => addItem(c)}>
                  <div className="main"><div className="t">{c.descricao}</div></div>
                  <span className="small faint num">{c.tipo === 'metro' ? (c.corte ? `corte ${c.corte}` : 'preço livre') : c.tipo === 'mao' ? '' : `${brl(precoCatalogo(c, cfg.precos))} / ${c.unidade}`}</span>
                  <Icon name="chev" className="chev" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn block" onClick={() => addItem(ITEM_LIVRE)}><Icon name="plus" />Outro item (digitar)</button>
      </Sheet>
      <ClienteSheet open={sheet === 'cliente'} onClose={fechar} onPick={(c, endereco, telefone) => { set({ clienteId: c?.id || null, clienteNome: c?.nome ?? o.clienteNome, endereco, telefone }); fechar(); }} orc={o} />
      {itemEdit && <ItemSheet key={itemEdit.id} open={sheet === 'item'} item={itemEdit} novo={!o.itens.some((x) => x.id === itemEdit.id)} onClose={fechar} onSave={salvarItem} onRemove={removerItem} />}
      <PagamentoSheet open={sheet === 'pagamento'} onClose={fechar} saldo={pag.saldo} parcelasAtuais={o.parcelas} feitos={o.pagamentos.length} onSave={async (p, parcelas) => { await registrarPagamento({ ...o, pagamentos: doBanco?.pagamentos ?? o.pagamentos }, p, parcelas); fechar(); toast(`Anotado: ${brl(p.valor)} em ${fmtData(p.data)}, ${p.forma}`); }} />
      <PdfSheet open={sheet === 'pdf'} onClose={fechar} orc={o} calheiros={calheiros} quitado={pag.situacao === 'quitado' && o.pagamentos.length > 0} onEnviado={() => { if (o.status === 'rascunho') set({ status: 'enviado', enviadoEm: hojeISO() }); }} />
      <CalheiroRapido open={sheet === 'calheiro'} onClose={fechar} onCriado={(c) => set({ calheiroIds: [...o.calheiroIds, c.id] })} />
      <Confirm open={sheet === 'separar'} onClose={fechar} title="Separar de novo?" text={`Este orçamento junto (nº ${o.numero}) será apagado e os ${origens.length} orçamentos antigos voltam ao normal.`} confirmLabel="Separar" onConfirm={async () => { apagado.current = true; window.clearTimeout(timer.current); await separarJuncao(o); toast('Orçamentos separados de novo'); replace('orcamentos'); }} />
      <Confirm open={sheet === 'apagar'} onClose={fechar} title={`Apagar o orçamento nº ${o.numero}?`} text={o.pagamentos.length ? 'Os pagamentos dele também saem do financeiro. Não dá para desfazer.' : 'Não dá para desfazer.'} confirmLabel="Apagar" danger onConfirm={async () => { apagado.current = true; window.clearTimeout(timer.current); await apagarOrcamento(o); toast('Orçamento apagado'); replace('orcamentos'); }} />
    </section>
  );
}

function PagamentoLinha({ n, p, onApagar }: { n: number; p: Orcamento['pagamentos'][number]; onApagar: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="row">
      <div className="ic ok"><Icon name="check" /></div>
      <div className="main"><div className="t">Parcela {n} · {brl(p.valor)}</div><div className="s">{fmtData(p.data)} · {p.forma} · {p.conta}</div></div>
      <button className="icon-btn" style={{ border: 0, background: 'none' }} aria-label="Apagar pagamento" onClick={() => setConfirm(true)}><Icon name="trash" style={{ width: 18, height: 18, color: 'var(--fg-3)' }} /></button>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Apagar este pagamento?" text="Ele também sai do financeiro." confirmLabel="Apagar" danger onConfirm={onApagar} />
    </div>
  );
}

// ---------------- escolher cliente ----------------
function ClienteSheet({ open, onClose, onPick, orc }: { open: boolean; onClose: () => void; onPick: (c: Cliente | null, endereco: string, telefone: string) => void; orc: Orcamento }) {
  const clientes = useClientes();
  const [q, setQ] = useState('');
  const [modo, setModo] = useState<'lista' | 'novo' | 'endereco'>('lista');
  const [sel, setSel] = useState<Cliente | null>(null);
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [salvar, setSalvar] = useState(true);
  const [end, setEnd] = useState(orc.endereco);
  const [fone, setFone] = useState(maskPhone(orc.telefone));

  useEffect(() => { if (open) { setQ(''); setModo('lista'); setSel(null); setNome(''); setTel(''); setSalvar(true); setEnd(orc.endereco); setFone(maskPhone(orc.telefone)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const t = semAcento(q.trim());
    return (t ? clientes.filter((c) => semAcento(c.nome).includes(t) || c.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')) : clientes).slice(0, 40);
  }, [clientes, q]);

  const escolher = (c: Cliente) => {
    const ends = c.enderecos.filter((e) => enderecoTexto(e));
    if (ends.length > 1) { setSel(c); setEnd(enderecoTexto(ends[0])); setModo('endereco'); return; }
    onPick(c, ends[0] ? enderecoTexto(ends[0]) : '', c.telefone || c.telefone2);
  };

  const criar = async () => {
    if (!nome.trim()) return;
    if (salvar) {
      const c = { ...novoCliente(nome.trim()), telefone: tel };
      await db.clientes.add(c);
      onPick(c, '', tel);
    } else onPick({ ...novoCliente(nome.trim()), id: '' } as Cliente, orc.endereco, tel);
  };

  return (
    <Sheet open={open} onClose={onClose} title={modo === 'novo' ? 'Cliente novo' : modo === 'endereco' ? 'Qual endereço?' : 'Cliente'}>
      {modo === 'lista' && (
        <>
          <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" /></div>
          <button className="btn block primary" onClick={() => { setNome(q); setModo('novo'); }}><Icon name="plus" />{q.trim() ? `Novo: “${q.trim()}”` : 'Cliente novo'}</button>
          {lista.length > 0 && (
            <div className="card list">
              {lista.map((c) => (
                <button key={c.id} className="row" onClick={() => escolher(c)}>
                  <div className="avatar">{iniciais(c.nome)}</div>
                  <div className="main"><div className="t">{c.nome}</div><div className="s">{[c.telefone, c.enderecos[0]?.bairro].filter(Boolean).join(' · ') || '—'}</div></div>
                  {orc.clienteId === c.id && <Icon name="check" style={{ width: 18, height: 18, color: 'var(--red)' }} />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {modo === 'novo' && (
        <>
          <div className="field"><label htmlFor="cn-nome">Nome</label><input id="cn-nome" className="input" autoFocus autoCapitalize="words" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" /></div>
          <div className="field"><label htmlFor="cn-tel">Telefone <span className="faint">(opcional)</span></label><PhoneInput id="cn-tel" value={tel} onChange={setTel} /></div>
          <Seg label="Salvar" value={salvar ? 's' : 'n'} onChange={(v) => setSalvar(v === 's')} options={[{ value: 's', label: 'Salvar nos clientes' }, { value: 'n', label: 'Só neste orçamento' }]} />
          <p className="hint" style={{ margin: 0 }}>{salvar ? 'Depois você completa o endereço na ficha do cliente.' : 'Bom para calheiro ou balcão que pega material e você nem sabe quem é o cliente.'}</p>
          <button className="btn block primary" disabled={!nome.trim()} onClick={criar}><Icon name="check" />Usar este cliente</button>
        </>
      )}
      {modo === 'endereco' && sel && (
        <>
          <div className="card list">
            {sel.enderecos.filter((e) => enderecoTexto(e)).map((e) => (
              <button key={e.id} className="row" onClick={() => onPick(sel, enderecoTexto(e), sel.telefone || sel.telefone2)}>
                <div className="ic mute"><Icon name="pin" /></div>
                <div className="main"><div className="t" style={{ whiteSpace: 'normal' }}>{enderecoTexto(e)}</div><div className="s">{e.cidade}/{e.uf}</div></div>
              </button>
            ))}
          </div>
          <div className="field"><label htmlFor="cs-end">Ou digite outro só para este orçamento</label><input id="cs-end" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <button className="btn block" onClick={() => onPick(sel, end, sel.telefone || sel.telefone2)}>Usar este endereço</button>
        </>
      )}
      {modo === 'lista' && orc.clienteNome && (
        <div className="card form-card">
          <h3>Neste orçamento</h3>
          <div className="field"><label htmlFor="cs-e2">Endereço</label><input id="cs-e2" className="input" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Rua, número - bairro" /></div>
          <div className="field"><label htmlFor="cs-t2">Fone</label><PhoneInput id="cs-t2" value={fone} onChange={setFone} /></div>
          <button className="btn" onClick={() => onPick({ id: orc.clienteId ?? '', nome: orc.clienteNome } as Cliente, end, fone)}>Salvar endereço e fone</button>
        </div>
      )}
    </Sheet>
  );
}

// ---------------- item ----------------
function ItemSheet({ open, item, novo, onClose, onSave, onRemove }: { open: boolean; item: Item; novo: boolean; onClose: () => void; onSave: (i: Item) => void; onRemove: (id: string) => void }) {
  const cfg = useConfig();
  const [it, setIt] = useState<Item>(item);
  const set = (p: Partial<Item>) => setIt((x) => ({ ...x, ...p }));
  const metro = it.tipo === 'metro';
  const auto = metro && !!it.corte && !it.precoManual;
  const unit = auto ? precoMetroItem(it, cfg) : it.precoUnit;
  const total = r2(unit * it.quantidade);
  const ok = it.descricao.trim() && it.quantidade > 0;

  return (
    <Sheet open={open} onClose={onClose} title={novo ? 'Adicionar item' : 'Editar item'}>
      <div className="field"><label htmlFor="i-desc">Descrição</label><input id="i-desc" className="input" autoCapitalize="sentences" value={it.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: Calhas e rufos" autoFocus={!it.descricao} /></div>

      {it.tipo === 'mao' ? (
        <div className="field"><label htmlFor="i-mao">Valor da mão de obra</label><MoneyInput id="i-mao" value={it.precoUnit} onChange={(v) => set({ precoUnit: v ?? 0, quantidade: 1 })} autoFocus /></div>
      ) : (
        <>
          <div className="grid-3-1">
            <div className="field"><label htmlFor="i-q">{metro ? 'Metragem' : 'Quantidade'}</label><DecimalInput id="i-q" value={it.quantidade} onChange={(quantidade) => set({ quantidade })} placeholder="0" autoFocus={!!it.descricao} className="money" /></div>
            <div className="field"><label htmlFor="i-u">Unidade</label><select id="i-u" className="input" value={it.unidade} onChange={(e) => set({ unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></div>
          </div>
          {it.condutor && it.quantidade > 0 && <span className="hint">= {qtd(it.quantidade / 2)} barra{it.quantidade / 2 === 1 ? '' : 's'} de 2 m</span>}

          {metro && (
            <>
              <div className="grid2">
                <div className="field"><label htmlFor="i-c">Corte</label>
                  <select id="i-c" className="input" value={it.corte ?? ''} onChange={(e) => set({ corte: e.target.value ? Number(e.target.value) : null, precoManual: !e.target.value })}>
                    <option value="">Sem corte</option>
                    {CORTES.map((c) => <option key={c} value={c}>{c} cm{c > 65 && c < 120 ? ' (do 120)' : ''}</option>)}
                  </select>
                </div>
                <div className="field"><span className="label">Chapa</span><Seg label="Chapa" value={String(it.chapa ?? 26)} onChange={(v) => set({ chapa: Number(v) as 24 | 26 })} options={[{ value: '26', label: '26' }, { value: '24', label: '24' }]} /></div>
              </div>
              {it.corte ? (
                <div className="card pad small" style={{ boxShadow: 'none', background: 'var(--surface-2)', border: 0 }}>
                  <div className="num">{dec2(it.corte / 100)} m × {brl(cfg.precoMetro * (it.chapa === 24 ? cfg.fatorChapa24 : 1))} = <b>{brl(precoMetroItem(it, cfg))} por metro</b></div>
                  <div className="faint num">Tabela R$ 65: {brl(r2((it.corte / 100) * 65 * (it.chapa === 24 ? cfg.fatorChapa24 : 1)))} por metro</div>
                </div>
              ) : null}
            </>
          )}

          <div className="field">
            <div className="hrow between"><label htmlFor="i-p" className="label">Preço por {it.unidade}</label>
              {metro && it.corte ? <button className="link small" onClick={() => set({ precoManual: !it.precoManual, precoUnit: it.precoManual ? it.precoUnit : unit })}>{it.precoManual ? 'Usar o cálculo' : 'Digitar preço'}</button> : null}
            </div>
            {auto ? <input id="i-p" className="input money" readOnly value={brl(unit)} /> : <MoneyInput id="i-p" value={it.precoUnit} onChange={(v) => set({ precoUnit: v ?? 0 })} />}
          </div>
        </>
      )}

      <div className="card list" style={{ boxShadow: 'none' }}><div className="kv total"><span className="k">Total do item</span><span className="v">{brl(it.tipo === 'mao' ? it.precoUnit : total)}</span></div></div>

      <button className="btn block primary" disabled={!ok} onClick={() => onSave({ ...it, descricao: it.descricao.trim(), precoUnit: auto ? it.precoUnit : it.precoUnit })}><Icon name="check" />{novo ? 'Adicionar' : 'Salvar'}</button>
      {!novo && <button className="btn block danger" onClick={() => onRemove(it.id)}><Icon name="trash" />Remover item</button>}
    </Sheet>
  );
}

// ---------------- pagamento ----------------
function PagamentoSheet({ open, onClose, saldo, parcelasAtuais, feitos, onSave }: { open: boolean; onClose: () => void; saldo: number; parcelasAtuais: number; feitos: number; onSave: (p: { data: string; valor: number; forma: string; conta: string }, parcelas: number) => void }) {
  const [valor, setValor] = useState<number | null>(saldo);
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState('Pix');
  const [conta, setConta] = useState('Sicoob');
  const [parcelas, setParcelas] = useState(Math.max(parcelasAtuais, feitos + 1));
  useEffect(() => { if (open) { setValor(saldo); setData(hojeISO()); setForma('Pix'); setConta('Sicoob'); setParcelas(Math.max(parcelasAtuais, feitos + 1)); } }, [open, saldo, parcelasAtuais, feitos]);
  const ok = (valor ?? 0) > 0 && data;
  return (
    <Sheet open={open} onClose={onClose} title="Registrar pagamento">
      <div className="field"><label htmlFor="p-v">Valor recebido</label><MoneyInput id="p-v" value={valor} onChange={setValor} autoFocus /><span className="hint">Falta {brl(saldo)}</span></div>
      <div className="field"><label htmlFor="p-d">Data</label><input id="p-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></div>
      <div className="field"><span className="label">Forma</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{FORMAS_PAGAMENTO.map((f) => <button key={f} className="chip" aria-pressed={forma === f} onClick={() => { setForma(f); setConta(contaPadrao(f)); }}>{f}</button>)}</div>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="p-c">Entrou na conta</label><select id="p-c" className="input" value={conta} onChange={(e) => setConta(e.target.value)}>{CONTAS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="p-n">Em quantas parcelas</label><select id="p-n" className="input" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => n > feitos).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista (1x)' : `${n}x`}</option>)}</select></div>
      </div>
      <p className="hint" style={{ margin: 0 }}>Vai ser a parcela {feitos + 1} de {parcelas}. O pagamento entra sozinho no financeiro.</p>
      <button className="btn block primary" disabled={!ok} onClick={() => onSave({ valor: valor ?? 0, data, forma, conta }, parcelas)}><Icon name="check" />Registrar {valor ? brl(valor) : ''}</button>
    </Sheet>
  );
}

// ---------------- PDF ----------------
function PdfSheet({ open, onClose, orc, calheiros, quitado, onEnviado }: { open: boolean; onClose: () => void; orc: Orcamento; calheiros: Calheiro[]; quitado: boolean; onEnviado: () => void }) {
  const cfg = useConfig();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setFile(null); setErro('');
    import('../lib/pdf')
      .then(async ({ carregarAssets, dadosDoOrcamento, gerarPDF }) => {
        const a = await carregarAssets();
        if (!vivo) return;
        const doc = gerarPDF(dadosDoOrcamento(orc, calheiros, cfg), a);
        const f = new File([doc.output('blob')], nomeArquivo(orc, quitado), { type: 'application/pdf' });
        setFile(f);
        setUrl(URL.createObjectURL(f));
      })
      .catch(() => vivo && setErro('Não consegui montar o PDF. Confira a internet e tente de novo.'));
    return () => { vivo = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <Sheet open={open} onClose={onClose} title="PDF do orçamento">
      {erro ? <p className="err">{erro}</p> : !file ? <p className="muted">Montando o PDF…</p> : (
        <>
          <div className="card" style={{ overflow: 'hidden', aspectRatio: '419 / 595', maxWidth: '100%', background: '#fff' }}>
            <iframe title="Prévia do PDF" src={url + '#toolbar=0&view=FitH'} style={{ width: '100%', height: '100%', border: 0 }} />
          </div>
          <div className="small muted" style={{ wordBreak: 'break-word' }}>{file.name}</div>
          <button className="btn block primary" onClick={async () => {
            const r = await compartilharArquivo(file);
            if (r !== 'cancelado') { onEnviado(); toast(r === 'ok' ? 'PDF enviado' : 'PDF baixado'); onClose(); }
          }}><Icon name="share" />Enviar (WhatsApp, Arquivos…)</button>
          <a className="btn block" href={url} target="_blank" rel="noreferrer"><Icon name="doc" />Abrir em tela cheia</a>
        </>
      )}
    </Sheet>
  );
}

// ---------------- calheiro rápido ----------------
export function CalheiroRapido({ open, onClose, onCriado }: { open: boolean; onClose: () => void; onCriado?: (c: Calheiro) => void }) {
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  useEffect(() => { if (open) { setNome(''); setTel(''); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Novo calheiro">
      <div className="field"><label htmlFor="ca-n">Nome</label><input id="ca-n" className="input" autoFocus autoCapitalize="words" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Zé Carlos" /></div>
      <div className="field"><label htmlFor="ca-t">Telefone <span className="faint">(opcional)</span></label><PhoneInput id="ca-t" value={tel} onChange={setTel} /></div>
      <button className="btn block primary" disabled={!nome.trim()} onClick={async () => {
        const c: Calheiro = { id: uid(), nome: nome.trim(), telefone: tel, ativo: true, criadoEm: new Date().toISOString() };
        await db.calheiros.add(c);
        onCriado?.(c);
        onClose();
      }}><Icon name="check" />Cadastrar</button>
    </Sheet>
  );
}
