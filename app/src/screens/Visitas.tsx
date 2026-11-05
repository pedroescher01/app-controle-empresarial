import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Calheiro, type Cliente, type Escada, type Periodo, type Visita } from '../lib/db';
import { go, replace } from '../lib/router';
import { useCalheiros, useClientes } from '../lib/hooks';
import { addDias, diasEntre, fmtDataCurta, fromISO, haDias, hojeISO, iniciais, semAcento, telLink, uid, waLink } from '../lib/format';
import { enderecoTexto } from '../lib/calc';
import { Confirm, Empty, Icon, PhoneInput, Pill, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { novoCliente, novoEndereco } from './Clientes';
import { criarOrcamentoDaVisita } from './orcamentoActions';

export const PRECISA = ['Calha', 'Rufo', 'Pingadeira', 'Condutor', 'Goteira', 'Telhado'];
export const ESCADA: Record<Escada, string> = { normal: 'Normal', alta: 'Alta', muito_alta: 'Muito alta' };
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function quando(data: string | null, periodo: Periodo | null | undefined) {
  if (!data) return '';
  const hoje = hojeISO();
  const dia = data === hoje ? 'Hoje' : data === addDias(hoje, 1) ? 'Amanhã' : data === addDias(hoje, -1) ? 'Ontem' : `${DIAS[fromISO(data).getDay()]}, ${fmtDataCurta(data)}`;
  return periodo ? `${dia} ${periodo === 'manha' ? 'de manhã' : 'à tarde'}` : dia;
}

function Ladder({ n }: { n: number }) {
  return (
    <span className="ladder" aria-hidden="true">
      {[6, 10, 14].map((h, i) => <i key={h} style={{ height: h }} className={i < n ? 'on' : ''} />)}
    </span>
  );
}

export function EscadaPill({ e }: { e: Escada }) {
  const n = e === 'muito_alta' ? 3 : e === 'alta' ? 2 : 1;
  return <Pill cor={n === 3 ? 'red' : n === 2 ? 'warn' : 'mute'}><Ladder n={n} />Escada {ESCADA[e].toLowerCase()}{e === 'muito_alta' ? ' · barracão' : ''}</Pill>;
}

function mensagemConfirmacao(v: Visita) {
  const nome = v.nome.split(' ')[0];
  if (v.data) return `Olá, ${nome}! Aqui é da Calhas Andrade. Vamos passar aí ${quando(v.data, v.periodo).toLowerCase()} para medir o serviço. Vai ter alguém no local?`;
  return `Olá, ${nome}! Aqui é da Calhas Andrade. Estamos indo medir o serviço. Tem alguém no local agora?`;
}

// ======================= LISTA =======================
export function VisitasLista({ aba }: { aba: string }) {
  const visitas = useLiveQuery(() => db.visitas.orderBy('criadoEm').reverse().toArray(), [], []);
  const calheiros = useCalheiros();
  const [medir, setMedir] = useState<Visita | null>(null);
  const filtro = aba === 'medido' ? 'medido' : aba === 'agenda' ? 'agenda' : 'a_medir';
  const aMedir = visitas.filter((v) => v.status === 'a_medir');
  const lista = filtro === 'agenda' ? [] : visitas.filter((v) => v.status === filtro);

  return (
    <section className="stack">
      <TopBar eyebrow={aMedir.length ? `${aMedir.length} a medir` : 'Fila de visitas'} title="Visitas" right={<button className="icon-btn red" aria-label="Nova visita" onClick={() => go('visita/nova')}><Icon name="plus" /></button>} />
      <div className="seg" role="group" aria-label="Situação">
        <button aria-pressed={filtro === 'a_medir'} onClick={() => replace('visitas')}>A medir {aMedir.length > 0 && <span className="c">{aMedir.length}</span>}</button>
        <button aria-pressed={filtro === 'medido'} onClick={() => replace('visitas/medido')}>Medido</button>
        <button aria-pressed={filtro === 'agenda'} onClick={() => replace('visitas/agenda')}>Agenda</button>
      </div>

      {filtro === 'agenda' ? <Agenda visitas={visitas} calheiros={calheiros} /> : !lista.length ? (
        filtro === 'a_medir'
          ? <Empty icon="pin" title="Ninguém esperando medição" text="Quando um cliente pedir visita, anote aqui para não esquecer." action={<button className="btn primary" onClick={() => go('visita/nova')}><Icon name="plus" />Nova visita</button>} />
          : <Empty icon="check" title="Nenhuma visita medida ainda" />
      ) : (
        <div className="stack-s" style={{ gap: 12 }}>
          {lista.map((v) => <VisitaCard key={v.id} v={v} calheiros={calheiros} onMedido={() => setMedir(v)} />)}
        </div>
      )}
      {medir && <MedidoSheet v={medir} calheiros={calheiros} onClose={() => setMedir(null)} />}
    </section>
  );
}

function VisitaCard({ v, calheiros, onMedido }: { v: Visita; calheiros: Calheiro[]; onMedido: () => void }) {
  const toast = useToast();
  const dias = diasEntre(v.criadoEm, hojeISO());
  const cal = calheiros.find((c) => c.id === v.calheiroId)?.nome;
  const precisa = [v.precisa.join(', '), v.detalhe.trim()].filter(Boolean).join(' · ');
  const abrirOrcamento = async () => {
    if (v.orcamentoId && (await db.orcamentos.get(v.orcamentoId))) return go(`orcamento/${v.orcamentoId}`);
    const o = await criarOrcamentoDaVisita(v);
    toast('Orçamento criado com os dados da visita');
    go(`orcamento/${o.id}`);
  };
  return (
    <article className="card visit">
      <a className="hd" href={`#/visita/${v.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ minWidth: 0 }}>
          <div className="name">{v.nome || 'Sem nome'}</div>
          <div className="addr">{v.endereco || 'Sem endereço'}</div>
        </div>
        <span className={`age ${v.status === 'a_medir' && dias >= 10 ? 'old' : ''}`}>{haDias(v.criadoEm)}</span>
      </a>
      {precisa && <div className="need"><b>Precisa ver</b>{precisa}</div>}
      <div className="ft">
        <EscadaPill e={v.escada} />
        {v.data && v.status === 'a_medir' && <Pill cor={v.data < hojeISO() ? 'red' : 'info'}><Icon name="clock" style={{ width: 12, height: 12 }} />{quando(v.data, v.periodo)}</Pill>}
        {v.status === 'medido' && <Pill cor="ok"><Icon name="check" style={{ width: 12, height: 12 }} />Medido{cal ? ` · ${cal}` : ''}</Pill>}
        {v.status === 'a_medir' && cal && <Pill cor="mute">{cal}</Pill>}
      </div>
      <div className="ft">
        {v.telefone && <a className="btn ghost" aria-label={`Ligar para ${v.nome}`} href={telLink(v.telefone)}><Icon name="phone" /></a>}
        {v.telefone && <a className="btn ghost" aria-label={`WhatsApp de ${v.nome}`} href={waLink(v.telefone, v.status === 'a_medir' ? mensagemConfirmacao(v) : undefined)} target="_blank" rel="noreferrer"><Icon name="wa" /></a>}
        <span className="sp" />
        {v.status === 'a_medir'
          ? <button className="btn primary" onClick={onMedido}><Icon name="check" />Medido</button>
          : <button className="btn" onClick={abrirOrcamento}><Icon name="doc" />{v.orcamentoId ? 'Ver orçamento' : 'Fazer orçamento'}</button>}
      </div>
    </article>
  );
}

function MedidoSheet({ v, calheiros, onClose }: { v: Visita; calheiros: Calheiro[]; onClose: () => void }) {
  const toast = useToast();
  const [cal, setCal] = useState<string | null>(v.calheiroId);
  const salvar = async (orcar: boolean) => {
    await db.visitas.update(v.id, { status: 'medido', calheiroId: cal, medidoEm: hojeISO(), atualizadoEm: new Date().toISOString() });
    onClose();
    if (orcar) {
      const o = await criarOrcamentoDaVisita({ ...v, calheiroId: cal });
      go(`orcamento/${o.id}`);
    } else toast(`${v.nome} marcado como medido`);
  };
  return (
    <Sheet open onClose={onClose} title="Marcar como medido">
      <div className="field">
        <span className="label">Quem mediu?</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {calheiros.filter((c) => c.ativo).map((c) => <button key={c.id} className="chip" aria-pressed={cal === c.id} onClick={() => setCal(cal === c.id ? null : c.id)}>{cal === c.id && <Icon name="check" />}{c.nome}</button>)}
          {!calheiros.length && <span className="hint">Cadastre os calheiros em Mais → Calheiros.</span>}
        </div>
      </div>
      <button className="btn block primary" onClick={() => salvar(true)}><Icon name="doc" />Medido e fazer o orçamento</button>
      <button className="btn block ghost" onClick={() => salvar(false)}><Icon name="check" />Só marcar como medido</button>
    </Sheet>
  );
}

// ======================= AGENDA =======================
function Agenda({ visitas, calheiros }: { visitas: Visita[]; calheiros: Calheiro[] }) {
  const hoje = hojeISO();
  const servicos = useLiveQuery(() => db.orcamentos.where('servicoData').aboveOrEqual(addDias(hoje, -7)).toArray(), [hoje], []);
  type Ev = { id: string; data: string; periodo: Periodo | null | undefined; tipo: 'visita' | 'servico'; titulo: string; sub: string; href: string; atrasada: boolean };
  const eventos: Ev[] = [
    ...visitas.filter((v) => v.data && v.status === 'a_medir').map((v) => ({
      id: v.id, data: v.data!, periodo: v.periodo, tipo: 'visita' as const, titulo: v.nome, sub: [v.endereco, calheiros.find((c) => c.id === v.calheiroId)?.nome].filter(Boolean).join(' · '),
      href: `#/visita/${v.id}`, atrasada: v.data! < hoje,
    })),
    ...servicos.filter((o) => o.servicoData && o.status !== 'recusado').map((o) => ({
      id: o.id, data: o.servicoData!, periodo: o.servicoPeriodo, tipo: 'servico' as const, titulo: o.clienteNome || 'Sem cliente',
      sub: [o.endereco, o.calheiroIds.map((id) => calheiros.find((c) => c.id === id)?.nome).filter(Boolean).join(' e ')].filter(Boolean).join(' · '),
      href: `#/orcamento/${o.id}`, atrasada: false,
    })).filter((e) => e.data >= hoje),
  ].sort((a, b) => a.data.localeCompare(b.data) || (a.periodo === 'tarde' ? 1 : 0) - (b.periodo === 'tarde' ? 1 : 0));

  const grupos = useMemo(() => {
    const g = new Map<string, Ev[]>();
    eventos.forEach((e) => { const k = e.atrasada ? 'atrasada' : e.data; g.set(k, [...(g.get(k) ?? []), e]); });
    return [...g.entries()];
  }, [eventos]);

  if (!eventos.length) return <Empty icon="clock" title="Nada agendado" text="Visitas com data e serviços agendados nos orçamentos aparecem aqui." />;
  return (
    <div className="stack">
      {grupos.map(([k, evs]) => (
        <div key={k} className="stack-s">
          <div className="label" style={{ paddingLeft: 2, color: k === 'atrasada' ? 'var(--red)' : undefined }}>{k === 'atrasada' ? 'Visitas com data passada, ainda não medidas' : quando(k, null)}</div>
          <div className="card list">
            {evs.map((e) => (
              <a key={e.tipo + e.id} className="row" href={e.href}>
                <div className={`ic ${e.tipo === 'visita' ? 'red' : 'info'}`}><Icon name={e.tipo === 'visita' ? 'pin' : 'helmet'} /></div>
                <div className="main"><div className="t">{e.titulo}</div><div className="s">{e.tipo === 'visita' ? 'Medir' : 'Serviço'}{e.periodo ? ` · ${e.periodo === 'manha' ? 'manhã' : 'tarde'}` : ''}{e.sub ? ` · ${e.sub}` : ''}</div></div>
                <Icon name="chev" className="chev" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ======================= FORMULÁRIO =======================
const novaVisita = (): Visita => {
  const agora = new Date().toISOString();
  return { id: uid(), clienteId: null, nome: '', telefone: '', endereco: '', precisa: [], detalhe: '', escada: 'normal', status: 'a_medir', data: null, periodo: null, calheiroId: null, medidoEm: null, orcamentoId: null, criadoEm: agora, atualizadoEm: agora };
};

export function VisitaForm({ id }: { id?: string }) {
  const existente = useLiveQuery(async () => (id ? (await db.visitas.get(id)) ?? null : null), [id]);
  if (id && existente === undefined) return null;
  if (id && !existente) return <Empty icon="pin" title="Visita não encontrada" action={<button className="btn" onClick={() => go('visitas')}>Voltar</button>} />;
  return <VisitaFormInner key={id ?? 'nova'} inicial={existente ?? novaVisita()} nova={!id} />;
}

function VisitaFormInner({ inicial, nova }: { inicial: Visita; nova: boolean }) {
  const calheiros = useCalheiros();
  const toast = useToast();
  const [v, setV] = useState<Visita>(inicial);
  const [end, setEnd] = useState(novoEndereco());
  const [salvarCliente, setSalvarCliente] = useState(true);
  const [picker, setPicker] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [erro, setErro] = useState('');
  const set = (p: Partial<Visita>) => setV((x) => ({ ...x, ...p }));
  const vinculado = !!v.clienteId;

  const salvar = async () => {
    if (!v.nome.trim()) { setErro('Coloque o nome do cliente.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    let final = { ...v, nome: v.nome.trim(), atualizadoEm: new Date().toISOString() };
    if (!vinculado) {
      const endTxt = enderecoTexto(end);
      if (endTxt) final.endereco = endTxt;
      if (salvarCliente) {
        const c: Cliente = { ...novoCliente(final.nome), telefone: final.telefone, enderecos: [end] };
        await db.clientes.add(c);
        final = { ...final, clienteId: c.id };
      }
    }
    await db.visitas.put(final);
    toast(nova ? 'Visita anotada' : 'Visita salva');
    replace(final.status === 'medido' ? 'visitas/medido' : 'visitas');
  };

  return (
    <section className="stack">
      <TopBar onBack={() => go(v.status === 'medido' ? 'visitas/medido' : 'visitas')} backLabel="Visitas" eyebrow={nova ? 'Anotar pedido de visita' : `Anotada ${haDias(v.criadoEm)}`} title={nova ? 'Nova visita' : v.nome || 'Visita'} />

      {/* cliente */}
      <div className="card form-card">
        <h3>Cliente {!nova || vinculado ? null : <button className="link" onClick={() => setPicker(true)}>Buscar cadastrado</button>}</h3>
        {vinculado ? (
          <div className="hrow">
            <div className="avatar">{iniciais(v.nome)}</div>
            <div className="grow"><div style={{ fontWeight: 700 }}>{v.nome}</div><div className="small muted">{[v.endereco, v.telefone].filter(Boolean).join(' · ') || '—'}</div></div>
            <button className="link" onClick={() => setPicker(true)}>Trocar</button>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="v-nome">Nome</label>
              <input id="v-nome" className="input" autoCapitalize="words" value={v.nome} onChange={(e) => { set({ nome: e.target.value }); setErro(''); }} placeholder="Nome do cliente" />
              {erro && <span className="err">{erro}</span>}
            </div>
            <div className="field"><label htmlFor="v-tel">Telefone</label><PhoneInput id="v-tel" value={v.telefone} onChange={(telefone) => set({ telefone })} /></div>
            {nova ? (
              <>
                <div className="grid-3-1">
                  <div className="field"><label htmlFor="v-rua">Rua / avenida</label><input id="v-rua" className="input" autoCapitalize="words" value={end.logradouro} onChange={(e) => setEnd({ ...end, logradouro: e.target.value })} /></div>
                  <div className="field"><label htmlFor="v-num">Número</label><input id="v-num" className="input num" inputMode="numeric" value={end.numero} onChange={(e) => setEnd({ ...end, numero: e.target.value })} /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="v-bai">Bairro</label><input id="v-bai" className="input" autoCapitalize="words" value={end.bairro} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} /></div>
                  <div className="field"><label htmlFor="v-cid">Cidade</label><input id="v-cid" className="input" autoCapitalize="words" value={end.cidade} onChange={(e) => setEnd({ ...end, cidade: e.target.value })} /></div>
                </div>
                <Seg label="Salvar cliente" value={salvarCliente ? 's' : 'n'} onChange={(x) => setSalvarCliente(x === 's')} options={[{ value: 's', label: 'Salvar nos clientes' }, { value: 'n', label: 'Só nesta visita' }]} />
              </>
            ) : (
              <div className="field"><label htmlFor="v-end">Endereço</label><input id="v-end" className="input" value={v.endereco} onChange={(e) => set({ endereco: e.target.value })} /></div>
            )}
          </>
        )}
      </div>

      {/* o que precisa */}
      <div className="card form-card">
        <h3>O que precisa ver</h3>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {PRECISA.map((p) => {
            const on = v.precisa.includes(p);
            return <button key={p} className="chip" aria-pressed={on} onClick={() => set({ precisa: on ? v.precisa.filter((x) => x !== p) : [...v.precisa, p] })}>{on && <Icon name="check" />}{p}</button>;
          })}
        </div>
        <textarea className="input" aria-label="Detalhes" value={v.detalhe} onChange={(e) => set({ detalhe: e.target.value })} placeholder="Ex.: calha da frente vazando, trocar 2 condutores" style={{ minHeight: 70 }} />
      </div>

      {/* escada */}
      <div className="card form-card">
        <h3>Escada</h3>
        <Seg<Escada> label="Escada" value={v.escada} onChange={(escada) => set({ escada })} options={[{ value: 'normal', label: 'Normal' }, { value: 'alta', label: 'Alta' }, { value: 'muito_alta', label: 'Muito alta' }]} />
        {v.escada === 'muito_alta' && <span className="hint">Normalmente barracão.</span>}
      </div>

      {/* quando e quem */}
      <div className="card form-card">
        <h3>Quando {v.data && <button className="link" onClick={() => set({ data: null, periodo: null })}>Sem data</button>}</h3>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {[['Hoje', hojeISO()], ['Amanhã', addDias(hojeISO(), 1)]].map(([l, d]) => <button key={l} className="chip" aria-pressed={v.data === d} onClick={() => set({ data: v.data === d ? null : d })}>{l}</button>)}
          <input type="date" className="input" aria-label="Outra data" value={v.data ?? ''} onChange={(e) => set({ data: e.target.value || null })} style={{ width: 'auto', minHeight: 38, padding: '6px 10px', fontSize: 15 }} />
        </div>
        {v.data && <Seg label="Período" value={v.periodo ?? 'x'} onChange={(p) => set({ periodo: p === 'x' ? null : (p as Periodo) })} options={[{ value: 'x', label: 'Qualquer hora' }, { value: 'manha', label: 'Manhã' }, { value: 'tarde', label: 'Tarde' }]} />}
        {!v.data && <span className="hint">Sem data, a visita fica na fila “A medir” até dar certo.</span>}
        <div className="field">
          <span className="label">Quem vai</span>
          <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
            {calheiros.filter((c) => c.ativo || c.id === v.calheiroId).map((c) => <button key={c.id} className="chip" aria-pressed={v.calheiroId === c.id} onClick={() => set({ calheiroId: v.calheiroId === c.id ? null : c.id })}>{v.calheiroId === c.id && <Icon name="check" />}{c.nome}</button>)}
            {!calheiros.length && <span className="hint">Cadastre os calheiros em Mais → Calheiros.</span>}
          </div>
        </div>
      </div>

      {!nova && (
        <div className="stack-s">
          <div className="label" style={{ paddingLeft: 2 }}>Situação</div>
          <Seg label="Situação" value={v.status} onChange={(status) => set({ status, medidoEm: status === 'medido' ? v.medidoEm ?? hojeISO() : null })} options={[{ value: 'a_medir', label: 'A medir' }, { value: 'medido', label: 'Medido' }]} />
        </div>
      )}

      <button className="btn primary block" onClick={salvar}><Icon name="check" />{nova ? 'Anotar visita' : 'Salvar'}</button>
      {!nova && <button className="btn block danger" onClick={() => setApagar(true)}><Icon name="trash" />Apagar visita</button>}

      <ClientePicker open={picker} onClose={() => setPicker(false)} onPick={(c) => {
        const e = c.enderecos.find((x) => enderecoTexto(x));
        set({ clienteId: c.id, nome: c.nome, telefone: c.telefone || c.telefone2, endereco: e ? enderecoTexto(e) : '' });
        setPicker(false);
      }} />
      <Confirm open={apagar} onClose={() => setApagar(false)} title="Apagar esta visita?" text="Não dá para desfazer." confirmLabel="Apagar" danger onConfirm={async () => { await db.visitas.delete(v.id); toast('Visita apagada'); replace('visitas'); }} />
    </section>
  );
}

function ClientePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: Cliente) => void }) {
  const clientes = useClientes();
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  const t = semAcento(q.trim());
  const lista = (t ? clientes.filter((c) => semAcento(c.nome).includes(t) || (q.replace(/\D/g, '').length >= 3 && c.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))) : clientes).slice(0, 40);
  return (
    <Sheet open={open} onClose={onClose} title="Cliente cadastrado">
      <div className="search"><Icon name="search" /><input className="input" type="search" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" /></div>
      {lista.length ? (
        <div className="card list">
          {lista.map((c) => (
            <button key={c.id} className="row" onClick={() => onPick(c)}>
              <div className="avatar">{iniciais(c.nome)}</div>
              <div className="main"><div className="t">{c.nome}</div><div className="s">{[c.telefone, c.enderecos[0]?.bairro].filter(Boolean).join(' · ') || '—'}</div></div>
            </button>
          ))}
        </div>
      ) : <p className="muted" style={{ margin: 0 }}>{clientes.length ? 'Ninguém encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>}
    </Sheet>
  );
}
