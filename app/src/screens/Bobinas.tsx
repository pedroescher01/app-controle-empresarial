import { useState } from 'react';
import { db, type Fornecedor, type ItemPedido, type NivelProducao, type Pedido } from '../lib/db';
import { go, replace } from '../lib/router';
import { useBobinas, useConfig, useFornecedores, usePedidos, useRegistro } from '../lib/hooks';
import { CORTES_BOBINA, CONTAS, FORMAS_PAGAMENTO, contaPadrao } from '../lib/catalog';
import { BobinaDefs, BobinaIcone } from '../components/Bobina';
import { CHAPAS, ESPESSURA, NIVEIS, bobinasParaComprar, estadoBobina, listaPrioridade, nivelBobina, prioridade, historicoPreco, mensagemPedido, ordenarItens, resumoPedido, statusPedido, variacao } from '../lib/bobinas';
import { brl, dec2, fmtData, fmtDataCurta, hojeISO, iniciais, maskCNPJ, maskPhone, telLink, uid, waLink } from '../lib/format';
import { Confirm, DecimalInput, Empty, Icon, MoneyInput, PhoneInput, Pill, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { ArquivoSheet } from '../components/ArquivoSheet';
import { apagarPedido, conferirBobina, desfazerChegada, desfazerPagamento, marcarChegou, marcarPago, montarPedido, salvarPedido } from './pedidoActions';

// ======================= ESTOQUE =======================
export function Bobinas() {
  const bobinas = useBobinas();
  const pedidos = usePedidos();
  const fornecedores = useFornecedores();
  const [chapa, setChapa] = useState<24 | 26>(26);
  const [escolherForn, setEscolherForn] = useState(false);
  const comprar = bobinasParaComprar(bobinas, pedidos);
  const rascunho = pedidos.find((p) => !p.pedidoEm);
  const abertos = pedidos.filter((p) => !p.pagoEm || !p.chegouEm);
  const concluidos = pedidos.filter((p) => p.pagoEm && p.chegouEm).slice(0, 5);
  const conta = (c: 24 | 26) => CORTES_BOBINA.filter((k) => estadoBobina(bobinas, pedidos, c, k) === 'comprar').length;

  const [conferir, setConferir] = useState<number | null>(null);
  const lista = listaPrioridade(bobinas, pedidos);
  const ultima = bobinas.reduce((m, x) => (x.atualizadoEm > m ? x.atualizadoEm : m), '');
  const [soItens, setSoItens] = useState<ItemPedido[] | undefined>(undefined);
  const pedir = (itens?: ItemPedido[]) => { setSoItens(itens); if (fornecedores.length > 1) setEscolherForn(true); else novoPedido(fornecedores[0]?.id ?? null, itens); };
  const novoPedido = async (fornecedorId: string | null, itens = soItens) => {
    setEscolherForn(false);
    const p = await montarPedido(fornecedorId, itens);
    go(`pedido/${p.id}`);
  };

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" eyebrow="Estoque de bobinas" title="Bobinas" />
      <Seg<'26' | '24'> label="Espessura" value={String(chapa) as '26' | '24'} onChange={(v) => setChapa(Number(v) as 24 | 26)}
        options={CHAPAS.map((c) => ({ value: String(c) as '26' | '24', label: <>Chapa {c} <span className="faint" style={{ fontWeight: 500 }}>{ESPESSURA[c].replace(' mm', '')}</span>{conta(c) > 0 && <span className="c">{conta(c)}</span>}</> }))} />
      <div className="legend" style={{ flexWrap: 'wrap' }}>
        <span><i style={{ background: 'var(--red)', border: 0 }} />Urgente</span>
        <span><i style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }} />Repor</span>
        <span><i style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)' }} />De olho</span>
        <span><i style={{ background: 'var(--info-soft)', border: '1px solid var(--info)' }} />Pedida</span>
      </div>
      <BobinaDefs />
      <div className="grid-b">
        {CORTES_BOBINA.map((corte) => {
          const pr = prioridade(bobinas, pedidos, chapa, corte);
          const nv = NIVEIS.find((n) => n.k === nivelBobina(bobinas, chapa, corte))!;
          const semEstoque = estadoBobina(bobinas, pedidos, chapa, corte) !== 'ok';
          const rot = { urgente: 'Urgente', repor: 'Repor', olho: 'De olho', pedida: 'Pedida', ok: 'Ok' }[pr];
          return (
            <button key={corte} className={`bob p-${pr}`} onClick={() => setConferir(corte)} aria-label={`Corte ${corte}: ${rot}, produção ${nv.l.toLowerCase()}, ${semEstoque ? 'sem' : 'com'} estoque`}>
              <b>{corte}</b>
              <span className="rolos"><BobinaIcone nivel={semEstoque ? undefined : 'bastante'} /><BobinaIcone nivel={nv.k} /></span>
              <span>{rot}</span>
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ margin: '-6px 2px 0' }}>Toque na bobina para conferir: a 1ª bobina é a do estoque (tracejada = não tem) e a 2ª é a da produção, que vai afinando conforme acaba. {ultima ? `Última conferência: ${fmtData(ultima.slice(0, 10))}.` : ''}</p>

      {(lista.urgente.length > 0 || lista.repor.length > 0 || lista.olho.length > 0) && (
        <div className="card list">
          <div className="kv"><b style={{ fontFamily: 'var(--f-display)' }}>Prioridade de compra</b></div>
          {([['urgente', 'Urgente', 'Sem estoque e a da produção afinando/acabando', 'red'], ['repor', 'Repor o estoque', 'Sem estoque, mas a da produção ainda tem bastante', 'warn'], ['olho', 'Ficar de olho', 'Tem no estoque, mas a da produção está acabando', 'mute']] as const).map(([k, t, sub, cor]) => lista[k].length > 0 && (
            <div key={k} className="row" style={{ alignItems: 'flex-start' }}>
              <div className={`ic ${cor}`}><Icon name={k === 'olho' ? 'clock' : 'alert'} /></div>
              <div className="main"><div className="t">{t} · {lista[k].length}</div><div className="s" style={{ whiteSpace: 'normal' }}>{sub}</div>
                <div className="small" style={{ marginTop: 4, fontWeight: 600 }}>{ordenarItens(lista[k]).map((i) => `${i.corte}${i.chapa === 24 ? ' (ch. 24)' : ''}`).join(' · ')}</div></div>
            </div>
          ))}
          {comprar.length > 0 && (
            <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              {rascunho ? (
                <button className="btn block primary" onClick={async () => { await salvarPedido(rascunho.id, { itens: [...rascunho.itens, ...comprar] }); go(`pedido/${rascunho.id}`); }}><Icon name="plus" />Colocar no pedido nº {rascunho.numero}</button>
              ) : (
                <>
                  {lista.urgente.length > 0 && lista.urgente.length < comprar.length && <button className="btn block primary" onClick={() => pedir(lista.urgente)}><Icon name="wa" />Pedido só dos urgentes ({lista.urgente.length})</button>}
                  <button className={`btn block ${lista.urgente.length > 0 && lista.urgente.length < comprar.length ? '' : 'primary'}`} onClick={() => pedir(undefined)}><Icon name="wa" />Pedido de tudo que falta ({comprar.length})</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="h2"><h2>Pedidos</h2><a className="link" href="#/fornecedores">Fornecedores</a></div>
      {!pedidos.length ? (
        <Empty icon="truck" title="Nenhum pedido ainda" text="Marque as bobinas que faltam e toque em “Montar pedido”. A mensagem para o vendedor sai pronta." />
      ) : (
        <div className="card list">
          {[...abertos, ...concluidos].map((p) => <PedidoLinha key={p.id} p={p} f={fornecedores.find((x) => x.id === p.fornecedorId)} />)}
        </div>
      )}
      <a className="btn block ghost" href="#/bobinas/precos"><Icon name="cash" />Preço do quilo</a>

      {conferir != null && <ConferirSheet chapa={chapa} corte={conferir} onClose={() => setConferir(null)} />}
      <Sheet open={escolherForn} onClose={() => setEscolherForn(false)} title="Pedir de qual fornecedor?">
        <div className="card list">
          {fornecedores.map((f) => (
            <button key={f.id} className="row" onClick={() => novoPedido(f.id)}>
              <div className="avatar">{iniciais(f.nome)}</div>
              <div className="main"><div className="t">{f.nome}</div><div className="s">{[f.vendedor, f.telefone].filter(Boolean).join(' · ') || '—'}</div></div>
            </button>
          ))}
        </div>
      </Sheet>
    </section>
  );
}

function PedidoLinha({ p, f }: { p: Pedido; f?: Fornecedor }) {
  const st = statusPedido(p);
  return (
    <a className="row" href={`#/pedido/${p.id}`}>
      <div className={`ic ${st.cor}`}><Icon name="truck" /></div>
      <div className="main"><div className="t">Nº {p.numero} · {f?.nome ?? 'Sem fornecedor'}</div><div className="s">{resumoPedido(p)}</div></div>
      <Pill cor={st.cor}>{st.rotulo}</Pill>
    </a>
  );
}

// ======================= PEDIDO =======================
export function PedidoTela({ id }: { id: string }) {
  const p = useRegistro(usePedidos(), db.pedidos, id);
  if (p === undefined) return null;
  if (!p) return <Empty icon="truck" title="Pedido não encontrado" action={<button className="btn" onClick={() => go('bobinas')}>Voltar</button>} />;
  return <PedidoDetalhe p={p} />;
}

function PedidoDetalhe({ p }: { p: Pedido }) {
  const fornecedores = useFornecedores();
  const cfg = useConfig();
  const toast = useToast();
  const f = fornecedores.find((x) => x.id === p.fornecedorId);
  const st = statusPedido(p);
  const [sheet, setSheet] = useState<null | 'forn' | 'add' | 'nota' | 'pago' | 'pdf' | 'apagar' | 'chegou'>(null);
  const [obs, setObs] = useState(p.observacoes);
  const fechar = () => setSheet(null);
  const editavel = !p.chegouEm;
  const msg = mensagemPedido(p, f);
  const linkWa = f?.telefone ? waLink(f.telefone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const setItens = (itens: ItemPedido[]) => salvarPedido(p.id, { itens });
  const chapasNoPedido = [...new Set(p.itens.map((i) => i.chapa))].sort((a, b) => b - a);

  return (
    <section className="stack">
      <TopBar onBack={() => go('bobinas')} backLabel="Bobinas" eyebrow={`Pedido de compra nº ${p.numero}`} title={f?.nome ?? 'Pedido de bobinas'} right={<Pill cor={st.cor}>{st.rotulo}</Pill>} />

      <button className="card row" style={{ padding: 14 }} onClick={() => setSheet('forn')}>
        <div className="avatar">{f ? iniciais(f.nome) : <Icon name="truck" style={{ width: 20, height: 20 }} />}</div>
        <div className="main"><div className="t">{f?.nome ?? 'Escolher fornecedor'}</div><div className="s">{f ? [f.vendedor, f.telefone].filter(Boolean).join(' · ') || 'Sem vendedor cadastrado' : 'Toque para escolher ou cadastrar'}</div></div>
        <Icon name="chev" className="chev" />
      </button>

      <div className="h2"><h2>Bobinas</h2><span className="small faint">{p.itens.reduce((s, i) => s + i.quantidade, 0)} no total</span></div>
      <div className="card list">
        {!p.itens.length && <div className="row"><span className="muted">Nenhuma bobina neste pedido.</span></div>}
        {ordenarItens(p.itens).map((i) => (
          <div key={`${i.chapa}-${i.corte}`} className="row">
            <div className="q-box"><b>{i.corte}</b><small>cm</small></div>
            <div className="main"><div className="t">Corte {i.corte} · chapa {i.chapa}</div><div className="s">{ESPESSURA[i.chapa]} · galvanizada</div></div>
            {editavel ? (
              <div className="stepper">
                <button aria-label="Menos uma" onClick={() => setItens(i.quantidade > 1 ? p.itens.map((x) => (x === i ? { ...x, quantidade: x.quantidade - 1 } : x)) : p.itens.filter((x) => x !== i))}>{i.quantidade > 1 ? '−' : <Icon name="trash" style={{ width: 15, height: 15 }} />}</button>
                <span className="num">{i.quantidade}</span>
                <button aria-label="Mais uma" onClick={() => setItens(p.itens.map((x) => (x === i ? { ...x, quantidade: x.quantidade + 1 } : x)))}>+</button>
              </div>
            ) : <b className="num">{i.quantidade}</b>}
          </div>
        ))}
        {editavel && <div className="row"><button className="btn block ghost" onClick={() => setSheet('add')}><Icon name="plus" />Adicionar bobina</button></div>}
      </div>

      <div className="card form-card">
        <div className="field"><label htmlFor="pd-obs">Observações</label><textarea id="pd-obs" className="input" value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== p.observacoes && salvarPedido(p.id, { observacoes: obs })} placeholder="Ex.: entregar de manhã" style={{ minHeight: 64 }} /></div>
      </div>

      {/* etapas */}
      <div className="h2"><h2>Etapas</h2></div>
      <div className="card list etapas">
        <Etapa n={1} feita={!!p.pedidoEm} titulo="Mandar o pedido" sub={p.pedidoEm ? `Mandado em ${fmtData(p.pedidoEm)}` : 'A mensagem sai pronta para o vendedor'}
          desfazer={p.pedidoEm && !p.notaEm && !p.chegouEm ? () => salvarPedido(p.id, { pedidoEm: null }) : undefined}>
          {!p.pedidoEm && (
            <div className="btns">
              <a className="btn primary" href={linkWa} target="_blank" rel="noreferrer" onClick={() => { if (!p.itens.length) return; salvarPedido(p.id, { pedidoEm: hojeISO() }); }} aria-disabled={!p.itens.length}><Icon name="wa" />WhatsApp</a>
              <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(msg); toast('Mensagem copiada'); } catch { toast('Não deu para copiar'); } }}><Icon name="copy" />Copiar</button>
            </div>
          )}
          {!p.pedidoEm && <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => salvarPedido(p.id, { pedidoEm: hojeISO() })}>Já mandei de outro jeito</button>}
        </Etapa>
        <Etapa n={2} feita={!!p.notaEm} titulo="Nota do fornecedor" sub={p.notaEm ? [p.valorTotal ? brl(p.valorTotal) : '', p.pesoKg ? `${dec2(p.pesoKg)} kg` : '', p.precoKg26 ? `ch. 26 ${brl(p.precoKg26)}/kg` : '', p.precoKg24 ? `ch. 24 ${brl(p.precoKg24)}/kg` : ''].filter(Boolean).join(' · ') : 'Quando ele mandar o PDF com o valor'}
          acao={p.notaEm ? { rotulo: 'Editar', onClick: () => setSheet('nota') } : undefined}>
          {!p.notaEm && <button className="btn" onClick={() => setSheet('nota')} disabled={!p.pedidoEm}><Icon name="doc" />Registrar a nota</button>}
        </Etapa>
        <Etapa n={3} feita={!!p.chegouEm} titulo="Chegou" sub={p.chegouEm ? `Chegou em ${fmtData(p.chegouEm)} · bobinas de volta no estoque` : 'As bobinas voltam para o estoque'}
          desfazer={p.chegouEm ? () => desfazerChegada(p).then(() => toast('Chegada desfeita')) : undefined}>
          {!p.chegouEm && <button className="btn" onClick={() => setSheet('chegou')} disabled={!p.pedidoEm}><Icon name="truck" />Marcar que chegou</button>}
        </Etapa>
        <Etapa n={4} feita={!!p.pagoEm} titulo="Pago" sub={p.pagoEm ? `Pago em ${fmtData(p.pagoEm)} · ${p.formaPagamento} · ${p.valorTotal ? brl(p.valorTotal) : ''} · lançado no financeiro` : 'Vira saída no financeiro'}
          desfazer={p.pagoEm ? () => desfazerPagamento(p).then(() => toast('Pagamento desfeito e tirado do financeiro')) : undefined}>
          {!p.pagoEm && <button className="btn" onClick={() => setSheet('pago')} disabled={!p.pedidoEm}><Icon name="cash" />Marcar como pago</button>}
        </Etapa>
      </div>

      <button className="btn block" onClick={() => setSheet('pdf')}><Icon name="doc" />PDF do pedido</button>
      {f?.telefone && <a className="btn block ghost" href={telLink(f.telefone)}><Icon name="phone" />Ligar para {f.vendedor || f.nome}</a>}
      <button className="btn block danger" onClick={() => setSheet('apagar')}><Icon name="trash" />Apagar pedido</button>

      <FornecedorPicker open={sheet === 'forn'} atual={p.fornecedorId} onClose={fechar} onPick={(fid) => { salvarPedido(p.id, { fornecedorId: fid }); fechar(); }} />
      {sheet === 'add' && <AddBobinaSheet onClose={fechar} onAdd={(chapa, corte) => {
        const ex = p.itens.find((x) => x.chapa === chapa && x.corte === corte);
        setItens(ex ? p.itens.map((x) => (x === ex ? { ...x, quantidade: x.quantidade + 1 } : x)) : [...p.itens, { chapa, corte, quantidade: 1 }]);
        toast(`Corte ${corte} · chapa ${chapa} adicionado`);
      }} />}
      {sheet === 'nota' && <NotaSheet p={p} chapas={chapasNoPedido} onClose={fechar} />}
      {sheet === 'chegou' && <DataSheet titulo="Quando chegou?" botao="Marcar que chegou" onClose={fechar} onOk={async (d) => { await marcarChegou(p, d); fechar(); toast('Bobinas de volta no estoque'); }} />}
      {sheet === 'pago' && <PagoSheet p={p} f={f} onClose={fechar} />}
      {sheet === 'pdf' && <ArquivoSheet titulo={`PDF do pedido nº ${p.numero}`} onClose={fechar} gerar={async () => {
        const [{ carregarAssets }, { gerarPedidoPDF }] = await Promise.all([import('../lib/pdf'), import('../lib/pedidoPdf')]);
        return gerarPedidoPDF(p, f, await carregarAssets(), cfg.email);
      }} />}
      <Confirm open={sheet === 'apagar'} onClose={fechar} title={`Apagar o pedido nº ${p.numero}?`} text={p.pagoEm ? 'O pagamento dele também sai do financeiro.' : 'As bobinas dele voltam para “Comprar”.'} confirmLabel="Apagar" danger
        onConfirm={async () => { await apagarPedido(p); toast('Pedido apagado'); replace('bobinas'); }} />
    </section>
  );
}

function Etapa({ n, feita, titulo, sub, children, desfazer, acao }: { n: number; feita: boolean; titulo: string; sub: string; children?: React.ReactNode; desfazer?: () => void; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div className={`etapa ${feita ? 'feita' : ''}`}>
      <div className="num-et">{feita ? <Icon name="check" /> : n}</div>
      <div className="grow stack-s" style={{ gap: 8 }}>
        <div className="hrow between" style={{ alignItems: 'flex-start' }}>
          <div className="grow"><div style={{ fontWeight: 650 }}>{titulo}</div><div className="small muted">{sub}</div></div>
          {desfazer && <button className="link small" onClick={desfazer}>Desfazer</button>}
          {acao && <button className="link small" onClick={acao.onClick}>{acao.rotulo}</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function AddBobinaSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (chapa: 24 | 26, corte: number) => void }) {
  const [chapa, setChapa] = useState<24 | 26>(26);
  return (
    <Sheet open onClose={onClose} title="Adicionar bobina">
      <Seg<'26' | '24'> label="Chapa" value={String(chapa) as '26' | '24'} onChange={(v) => setChapa(Number(v) as 24 | 26)} options={CHAPAS.map((c) => ({ value: String(c) as '26' | '24', label: `Chapa ${c} · ${ESPESSURA[c]}` }))} />
      <div className="grid-b">{CORTES_BOBINA.map((c) => <button key={c} className="bob" onClick={() => onAdd(chapa, c)}><b>{c}</b><span>cm</span></button>)}</div>
      <button className="btn block" onClick={onClose}>Pronto</button>
    </Sheet>
  );
}

function NotaSheet({ p, chapas, onClose }: { p: Pedido; chapas: (24 | 26)[]; onClose: () => void }) {
  const toast = useToast();
  const [valor, setValor] = useState<number | null>(p.valorTotal);
  const [peso, setPeso] = useState(p.pesoKg ?? 0);
  const [k26, setK26] = useState<number | null>(p.precoKg26);
  const [k24, setK24] = useState<number | null>(p.precoKg24);
  const [data, setData] = useState(p.notaEm ?? hojeISO());
  const sugestao = valor && peso ? valor / peso : null;
  return (
    <Sheet open onClose={onClose} title="Nota do fornecedor">
      <div className="field"><label htmlFor="nt-v">Valor total da nota</label><MoneyInput id="nt-v" value={valor} onChange={setValor} allowEmpty autoFocus /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="nt-kg">Peso (kg) <span className="faint">opcional</span></label><DecimalInput id="nt-kg" value={peso} onChange={setPeso} placeholder="0" /></div>
        <div className="field"><label htmlFor="nt-d">Data da nota</label><input id="nt-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
      </div>
      {(chapas.includes(26) || !chapas.length) && <div className="field"><label htmlFor="nt-26">Preço do kg · chapa 26</label><MoneyInput id="nt-26" value={k26} onChange={setK26} allowEmpty /></div>}
      {chapas.includes(24) && <div className="field"><label htmlFor="nt-24">Preço do kg · chapa 24</label><MoneyInput id="nt-24" value={k24} onChange={setK24} allowEmpty /></div>}
      {sugestao && !k26 && !k24 ? <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => (chapas.includes(24) && !chapas.includes(26) ? setK24(Math.round(sugestao * 100) / 100) : setK26(Math.round(sugestao * 100) / 100))}>Usar valor ÷ peso: {brl(sugestao)}/kg</button> : null}
      <span className="hint">O preço do kg vai para o histórico, para ver se a bobina está subindo.</span>
      <button className="btn block primary" disabled={!valor} onClick={async () => { await salvarPedido(p.id, { valorTotal: valor, pesoKg: peso || null, precoKg26: k26, precoKg24: k24, notaEm: data }); toast('Nota registrada'); onClose(); }}><Icon name="check" />Salvar nota</button>
    </Sheet>
  );
}

function DataSheet({ titulo, botao, onClose, onOk }: { titulo: string; botao: string; onClose: () => void; onOk: (d: string) => void }) {
  const [data, setData] = useState(hojeISO());
  return (
    <Sheet open onClose={onClose} title={titulo}>
      <div className="field"><label htmlFor="ds-d">Data</label><input id="ds-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
      <button className="btn block primary" onClick={() => onOk(data)}><Icon name="check" />{botao}</button>
    </Sheet>
  );
}

function PagoSheet({ p, f, onClose }: { p: Pedido; f?: Fornecedor; onClose: () => void }) {
  const toast = useToast();
  const [valor, setValor] = useState<number | null>(p.valorTotal);
  const [data, setData] = useState(hojeISO());
  const [forma, setForma] = useState(p.formaPagamento || 'Pix');
  const [conta, setConta] = useState(p.contaPagamento || 'Sicoob');
  return (
    <Sheet open onClose={onClose} title="Pagamento do pedido">
      <div className="field"><label htmlFor="pp-v">Valor pago</label><MoneyInput id="pp-v" value={valor} onChange={setValor} allowEmpty autoFocus={!valor} />{!p.valorTotal && <span className="hint">Dica: registre a nota antes, aí o valor já vem preenchido.</span>}</div>
      <div className="grid2">
        <div className="field"><label htmlFor="pp-d">Pago em</label><input id="pp-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value || hojeISO())} /></div>
        <div className="field"><label htmlFor="pp-c">Saiu da conta</label><select id="pp-c" className="input" value={conta} onChange={(e) => setConta(e.target.value)}>{CONTAS.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>{FORMAS_PAGAMENTO.map((x) => <button key={x} className="chip" aria-pressed={forma === x} onClick={() => { setForma(x); setConta(contaPadrao(x)); }}>{x}</button>)}</div>
      <button className="btn block primary" disabled={!(valor && valor > 0)} onClick={async () => {
        await marcarPago(p, f, { valor: valor ?? 0, data, forma, conta });
        toast(`Anotado: saída de ${brl(valor ?? 0)} em ${fmtDataCurta(data)}, ${f?.nome ?? 'fornecedor'}, ${forma}.`);
        onClose();
      }}><Icon name="check" />Marcar como pago</button>
    </Sheet>
  );
}

// ======================= FORNECEDORES =======================
function FornecedorPicker({ open, atual, onClose, onPick }: { open: boolean; atual: string | null; onClose: () => void; onPick: (id: string) => void }) {
  const fornecedores = useFornecedores();
  const [novo, setNovo] = useState(false);
  if (!open) return null;
  if (novo) return <FornecedorSheet f={null} onClose={() => setNovo(false)} onSalvo={(f) => { setNovo(false); onPick(f.id); }} />;
  return (
    <Sheet open onClose={onClose} title="Fornecedor">
      <button className="btn block primary" onClick={() => setNovo(true)}><Icon name="plus" />Novo fornecedor</button>
      {fornecedores.length > 0 && (
        <div className="card list">
          {fornecedores.map((f) => (
            <button key={f.id} className="row" onClick={() => onPick(f.id)}>
              <div className="avatar">{iniciais(f.nome)}</div>
              <div className="main"><div className="t">{f.nome}</div><div className="s">{[f.vendedor, f.telefone].filter(Boolean).join(' · ') || '—'}</div></div>
              {atual === f.id && <Icon name="check" style={{ width: 18, height: 18, color: 'var(--red)' }} />}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function Fornecedores() {
  const fornecedores = useFornecedores();
  const pedidos = usePedidos();
  const [edit, setEdit] = useState<Fornecedor | 'novo' | null>(null);
  return (
    <section className="stack">
      <TopBar onBack={() => go('bobinas')} backLabel="Bobinas" title="Fornecedores" right={<button className="icon-btn red" aria-label="Novo fornecedor" onClick={() => setEdit('novo')}><Icon name="plus" /></button>} />
      {!fornecedores.length ? (
        <Empty icon="truck" title="Nenhum fornecedor" text="Cadastre a Galvisa e os outros. O telefone é o do vendedor: é para ele que vai a mensagem do pedido." action={<button className="btn primary" onClick={() => setEdit('novo')}><Icon name="plus" />Cadastrar</button>} />
      ) : (
        <div className="card list">
          {fornecedores.map((f) => {
            const n = pedidos.filter((p) => p.fornecedorId === f.id).length;
            return (
              <button key={f.id} className="row" onClick={() => setEdit(f)}>
                <div className="avatar">{iniciais(f.nome)}</div>
                <div className="main"><div className="t">{f.nome}</div><div className="s">{[f.vendedor, f.telefone].filter(Boolean).join(' · ') || 'Sem vendedor'} · {n} pedido{n === 1 ? '' : 's'}</div></div>
                <Icon name="chev" className="chev" />
              </button>
            );
          })}
        </div>
      )}
      {edit && <FornecedorSheet f={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function FornecedorSheet({ f, onClose, onSalvo }: { f: Fornecedor | null; onClose: () => void; onSalvo?: (f: Fornecedor) => void }) {
  const pedidos = usePedidos();
  const toast = useToast();
  const [x, setX] = useState<Fornecedor>(f ?? { id: uid(), nome: '', cnpj: '', vendedor: '', telefone: '', criadoEm: new Date().toISOString() });
  const [apagar, setApagar] = useState(false);
  const set = (p: Partial<Fornecedor>) => setX((v) => ({ ...v, ...p }));
  const usados = f ? pedidos.filter((p) => p.fornecedorId === f.id).length : 0;
  return (
    <Sheet open onClose={onClose} title={f ? 'Fornecedor' : 'Novo fornecedor'}>
      <div className="field"><label htmlFor="fo-n">Nome</label><input id="fo-n" className="input" autoCapitalize="words" value={x.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Galvisa" autoFocus={!f} /></div>
      <div className="field"><label htmlFor="fo-c">CNPJ</label><input id="fo-c" className="input num" inputMode="numeric" value={x.cnpj} onChange={(e) => set({ cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" /></div>
      <div className="field"><label htmlFor="fo-v">Vendedor</label><input id="fo-v" className="input" autoCapitalize="words" value={x.vendedor} onChange={(e) => set({ vendedor: e.target.value })} placeholder="Nome do vendedor" /></div>
      <div className="field"><label htmlFor="fo-t">Telefone do vendedor</label><PhoneInput id="fo-t" value={maskPhone(x.telefone)} onChange={(telefone) => set({ telefone })} /></div>
      <button className="btn block primary" disabled={!x.nome.trim()} onClick={async () => { const final = { ...x, nome: x.nome.trim() }; await db.fornecedores.put(final); toast(f ? 'Fornecedor salvo' : 'Fornecedor cadastrado'); if (onSalvo) onSalvo(final); else onClose(); }}><Icon name="check" />{f ? 'Salvar' : 'Cadastrar'}</button>
      {f && <button className="btn block danger" onClick={() => (usados ? toast(`Esse fornecedor tem ${usados} pedido${usados > 1 ? 's' : ''}. Apague os pedidos antes.`) : setApagar(true))}><Icon name="trash" />Apagar fornecedor</button>}
      <Confirm open={apagar} onClose={() => setApagar(false)} title={`Apagar ${x.nome}?`} confirmLabel="Apagar" danger onConfirm={async () => { await db.fornecedores.delete(x.id); toast('Fornecedor apagado'); onClose(); }} />
    </Sheet>
  );
}

// ======================= PREÇO DO QUILO =======================
export function PrecoKg() {
  const pedidos = usePedidos();
  const fornecedores = useFornecedores();
  const pts = historicoPreco(pedidos);
  return (
    <section className="stack">
      <TopBar onBack={() => go('bobinas')} backLabel="Bobinas" eyebrow="Histórico das notas" title="Preço do quilo" />
      {!pts.length ? (
        <Empty icon="cash" title="Ainda sem preços" text="Quando você registrar a nota de um pedido com o preço do kg, ele aparece aqui num gráfico." />
      ) : (
        <>
          <div className="split">
            {CHAPAS.map((c) => {
              const s = pts.filter((x) => x.chapa === c);
              const v = variacao(pts, c);
              return (
                <div key={c} className="card pad" style={{ boxShadow: 'none' }}>
                  <div className="k small muted" style={{ fontWeight: 600 }}>Chapa {c}</div>
                  <div className="n" style={{ fontFamily: 'var(--f-display)', fontWeight: 750, fontSize: 22 }}>{s.length ? brl(s[s.length - 1].precoKg) : '—'}<span className="small faint" style={{ fontWeight: 500 }}>{s.length ? '/kg' : ''}</span></div>
                  {v && <div className="small" style={{ color: v.pct > 0 ? 'var(--red)' : 'var(--ok)', fontWeight: 600 }}>{v.texto}</div>}
                </div>
              );
            })}
          </div>
          <GraficoPreco pts={pts} />
          <div className="card list">
            {[...pts].reverse().map((x, i) => (
              <div key={i} className="row">
                <div className="main"><div className="t">{brl(x.precoKg)}/kg · chapa {x.chapa}</div><div className="s">{fmtData(x.data)} · pedido nº {x.pedido} · {fornecedores.find((f) => f.id === x.fornecedorId)?.nome ?? '—'}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function GraficoPreco({ pts }: { pts: ReturnType<typeof historicoPreco> }) {
  // um ponto por nota (pedido), em ordem; duas notas no mesmo dia ficam lado a lado
  const notas = [...new Map(pts.map((p) => [`${p.data}#${p.pedido}`, p.data])).entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const chave = (p: { data: string; pedido: number }) => `${p.data}#${p.pedido}`;
  const vals = pts.map((p) => p.precoKg);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.2, (hi - lo) * 0.25);
  const y0 = Math.floor((lo - pad) * 10) / 10, y1 = Math.ceil((hi + pad) * 10) / 10;
  const W = 340, H = 160, L = 42, B = 22, T = 10, Rr = 12;
  const idx = (k: string) => notas.findIndex(([n]) => n === k);
  const sx = (k: string) => (notas.length === 1 ? (L + W - Rr) / 2 : L + ((W - Rr - L) * idx(k)) / (notas.length - 1));
  const sy = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const ticks = [y0, (y0 + y1) / 2, y1];
  const cor: Record<number, string> = { 26: 'var(--red)', 24: 'var(--info)' };
  return (
    <div className="card chart">
      <div className="hrow between" style={{ padding: '0 4px 8px' }}>
        <b style={{ fontFamily: 'var(--f-display)' }}>R$ por kg</b>
        <span className="legend"><span><i style={{ background: cor[26] }} />Chapa 26</span><span><i style={{ background: cor[24] }} />Chapa 24</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Preço do quilo ao longo do tempo">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 4} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={L - 5} y={sy(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--fg-3)">{t.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</text>
          </g>
        ))}
        {CHAPAS.map((c) => {
          const s = pts.filter((p) => p.chapa === c);
          if (!s.length) return null;
          return (
            <g key={c}>
              <polyline fill="none" stroke={cor[c]} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" points={s.map((p) => `${sx(chave(p))},${sy(p.precoKg)}`).join(' ')} />
              {s.map((p, i) => <circle key={i} cx={sx(chave(p))} cy={sy(p.precoKg)} r={i === s.length - 1 ? 4 : 2.8} fill={i === s.length - 1 ? cor[c] : 'var(--surface)'} stroke={cor[c]} strokeWidth={1.8} />)}
            </g>
          );
        })}
        {notas.map(([k, d], i) => (notas.length <= 6 || i % Math.ceil(notas.length / 6) === 0 || i === notas.length - 1) && <text key={k} x={sx(k)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--fg-3)">{fmtDataCurta(d)}</text>)}
      </svg>
    </div>
  );
}


function ConferirSheet({ chapa, corte, onClose }: { chapa: 24 | 26; corte: number; onClose: () => void }) {
  const bobinas = useBobinas();
  const pedidos = usePedidos();
  const e = estadoBobina(bobinas, pedidos, chapa, corte);
  const nivel = nivelBobina(bobinas, chapa, corte);
  return (
    <Sheet open onClose={onClose} title={`Corte ${corte} · chapa ${chapa}`}>
      {e === 'pedida' ? (
        <p className="muted" style={{ margin: 0 }}>Essa bobina já está num pedido. O estoque volta sozinho quando o pedido chegar.</p>
      ) : (
        <div className="field"><span className="label">A do estoque</span>
          <Seg label="Estoque" value={e === 'ok' ? 'tem' : 'nao'} onChange={(v) => conferirBobina(chapa, corte, { estado: v === 'tem' ? 'ok' : 'comprar' })} options={[{ value: 'tem', label: 'Tem no estoque' }, { value: 'nao', label: 'Não tem' }]} />
        </div>
      )}
      <div className="field"><span className="label">A da produção</span>
        <Seg<NivelProducao> label="Produção" value={nivel} onChange={(producao) => conferirBobina(chapa, corte, { producao })} options={NIVEIS.map((n) => ({ value: n.k, label: n.l }))} />
      </div>
      <button className="btn block primary" onClick={onClose}><Icon name="check" />Pronto</button>
    </Sheet>
  );
}
