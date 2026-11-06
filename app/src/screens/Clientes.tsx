import { useMemo, useState } from 'react';
import { db, type Cliente, type Endereco } from '../lib/db';
import { go, replace } from '../lib/router';
import { useClientes, useConfig, useOrcamentos, useRegistro } from '../lib/hooks';
import { Confirm, Empty, Icon, PhoneInput, Pill, Seg, TopBar, useToast } from '../components/ui';
import { brl, fmtData, iniciais, mapsLink, maskCNPJ, maskCPF, semAcento, telLink, uid, waLink } from '../lib/format';
import { calcular, enderecoTexto, statusVisual } from '../lib/calc';
import { criarOrcamento } from './orcamentoActions';

export const UFS = ['SP', 'MG', 'PR', 'RJ', 'GO', 'MS', 'SC', 'RS', 'BA', 'ES', 'DF', 'MT', 'TO', 'PE', 'CE', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'RO', 'AC', 'AP', 'RR'];

export const novoEndereco = (): Endereco => ({ id: uid(), logradouro: '', numero: '', bairro: '', cidade: 'Araras', uf: 'SP', complemento: '' });

export function novoCliente(nome = ''): Cliente {
  const agora = new Date().toISOString();
  return { id: uid(), nome, tipo: 'pf', documento: '', telefone: '', telefone2: '', enderecos: [novoEndereco()], observacoes: '', criadoEm: agora, atualizadoEm: agora };
}

// ======================= LISTA =======================
export function ClientesLista() {
  const clientes = useClientes();
  const [q, setQ] = useState('');
  const lista = useMemo(() => {
    const t = semAcento(q.trim());
    if (!t) return clientes;
    const dig = q.replace(/\D/g, '');
    return clientes.filter((c) => semAcento(c.nome).includes(t) || (dig.length >= 3 && c.telefone.replace(/\D/g, '').includes(dig)) || c.enderecos.some((e) => semAcento(e.bairro).includes(t)));
  }, [clientes, q]);

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" eyebrow={`${clientes.length} cadastrado${clientes.length === 1 ? '' : 's'}`} title="Clientes" right={<button className="icon-btn red" aria-label="Novo cliente" onClick={() => go('cliente/novo')}><Icon name="plus" /></button>} />
      <div className="search">
        <Icon name="search" />
        <input className="input" type="search" placeholder="Buscar por nome, telefone ou bairro" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
      </div>
      {!clientes.length ? (
        <Empty icon="users" title="Nenhum cliente ainda" text="Cadastre o primeiro cliente ou crie direto num orçamento novo." action={<button className="btn primary" onClick={() => go('cliente/novo')}><Icon name="plus" />Novo cliente</button>} />
      ) : !lista.length ? (
        <Empty icon="search" title="Ninguém encontrado" text={`Nenhum cliente com “${q}”.`} />
      ) : (
        <div className="card list">
          {lista.map((c) => {
            const e = c.enderecos[0];
            return (
              <a key={c.id} className="row" href={`#/cliente/${c.id}`}>
                <div className="avatar">{iniciais(c.nome)}</div>
                <div className="main">
                  <div className="t">{c.nome}</div>
                  <div className="s">{[c.telefone, e?.bairro || (e?.cidade !== 'Araras' ? e?.cidade : '')].filter(Boolean).join(' · ') || 'Sem telefone'}</div>
                </div>
                <Icon name="chev" className="chev" />
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ======================= DETALHE =======================
export function ClienteDetalhe({ id }: { id: string }) {
  const cfg = useConfig();
  const cliente = useRegistro(useClientes(), db.clientes, id);
  const orcs = useOrcamentos().filter((o) => o.clienteId === id).sort((a, b) => b.emitidoEm.localeCompare(a.emitidoEm));
  const toast = useToast();
  if (cliente === undefined) return null;
  if (!cliente) return <Empty icon="users" title="Cliente não encontrado" action={<button className="btn" onClick={() => go('clientes')}>Voltar</button>} />;

  const totais = orcs.map((o) => ({ o, r: calcular(o, cfg) }));
  const fechado = totais.filter(({ o }) => !o.juntadoNo).filter(({ o }) => o.status === 'aprovado' || o.pagamentos.length).reduce((s, { r }) => s + r.total, 0);
  const tel = cliente.telefone || cliente.telefone2;

  return (
    <section className="stack">
      <TopBar onBack={() => go('clientes')} backLabel="Clientes" eyebrow={cliente.tipo === 'pj' ? 'Empresa' : 'Pessoa física'} title={cliente.nome} right={<button className="icon-btn" aria-label="Editar" onClick={() => go(`cliente/${id}/editar`)}><Icon name="edit" /></button>} />

      <div className="quick">
        <a href={tel ? waLink(tel) : undefined} target="_blank" rel="noreferrer" onClick={(e) => { if (!tel) { e.preventDefault(); toast('Cadastre um telefone primeiro'); } }}><Icon name="wa" />WhatsApp</a>
        <a href={tel ? telLink(tel) : undefined} onClick={(e) => { if (!tel) { e.preventDefault(); toast('Cadastre um telefone primeiro'); } }}><Icon name="phone" />Ligar</a>
        <button onClick={async () => { const o = await criarOrcamento(cliente); go(`orcamento/${o.id}`); }}><Icon name="doc" />Orçamento</button>
      </div>

      <div className="card list">
        {cliente.telefone && <div className="kv"><span className="k">Telefone</span><span className="num">{cliente.telefone}</span></div>}
        {cliente.telefone2 && <div className="kv"><span className="k">Telefone 2</span><span className="num">{cliente.telefone2}</span></div>}
        {cliente.documento && <div className="kv"><span className="k">{cliente.tipo === 'pj' ? 'CNPJ' : 'CPF'}</span><span className="num">{cliente.documento}</span></div>}
        <div className="kv"><span className="k">Já fechou com a gente</span><span className="v">{brl(fechado)}</span></div>
      </div>

      {cliente.enderecos.filter((e) => enderecoTexto(e)).length > 0 && (
        <>
          <div className="h2"><h2>Endereços</h2></div>
          <div className="card list">
            {cliente.enderecos.filter((e) => enderecoTexto(e)).map((e) => (
              <a key={e.id} className="row" href={mapsLink(`${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade} - ${e.uf}`)} target="_blank" rel="noreferrer">
                <div className="ic mute"><Icon name="pin" /></div>
                <div className="main"><div className="t" style={{ whiteSpace: 'normal' }}>{enderecoTexto(e)}</div><div className="s">{e.cidade}/{e.uf} · abrir no mapa</div></div>
              </a>
            ))}
          </div>
        </>
      )}

      {cliente.observacoes && (
        <div className="card pad"><div className="label" style={{ marginBottom: 4 }}>Observações</div><div style={{ whiteSpace: 'pre-wrap' }}>{cliente.observacoes}</div></div>
      )}

      <div className="h2"><h2>Histórico</h2><span className="small faint">{orcs.length} orçamento{orcs.length === 1 ? '' : 's'}</span></div>
      {!orcs.length ? (
        <Empty icon="doc" title="Nenhum orçamento ainda" />
      ) : (
        <div className="card list">
          {totais.map(({ o, r }) => {
            const st = statusVisual(o, r.total);
            return (
              <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
                <div className="main"><div className="t">Nº {o.numero}</div><div className="s">{fmtData(o.emitidoEm)} · {o.itens.length} ite{o.itens.length === 1 ? 'm' : 'ns'}</div></div>
                <div className="v" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>{brl(r.total)}<Pill cor={st.cor}>{st.rotulo}</Pill></div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ======================= FORMULÁRIO =======================
export function ClienteForm({ id }: { id?: string }) {
  const existente = useRegistro(useClientes(), db.clientes, id);
  if (id && existente === undefined) return null;
  return <ClienteFormInner key={id ?? 'novo'} inicial={existente ?? novoCliente()} novo={!id} />;
}

function ClienteFormInner({ inicial, novo }: { inicial: Cliente; novo: boolean }) {
  const [c, setC] = useState<Cliente>(inicial);
  const [erro, setErro] = useState('');
  const [apagar, setApagar] = useState(false);
  const toast = useToast();
  const set = (p: Partial<Cliente>) => setC((x) => ({ ...x, ...p }));
  const setEnd = (i: number, p: Partial<Endereco>) => set({ enderecos: c.enderecos.map((e, j) => (j === i ? { ...e, ...p } : e)) });

  const salvar = async () => {
    if (!c.nome.trim()) {
      setErro('Coloque o nome do cliente.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const limpo: Cliente = { ...c, nome: c.nome.trim(), atualizadoEm: new Date().toISOString(), enderecos: c.enderecos.filter((e, i) => i === 0 || enderecoTexto(e)) };
    await db.clientes.put(limpo);
    // atualiza o nome nos orçamentos ainda não fechados
    await db.orcamentos.where('clienteId').equals(c.id).modify((o) => { if (!o.pagamentos.length) o.clienteNome = limpo.nome; });
    toast(novo ? 'Cliente cadastrado' : 'Alterações salvas');
    replace(`cliente/${c.id}`);
  };

  const remover = async () => {
    const n = await db.orcamentos.where('clienteId').equals(c.id).count();
    if (n) { toast(`Esse cliente tem ${n} orçamento${n > 1 ? 's' : ''}. Apague os orçamentos antes.`); return; }
    await db.clientes.delete(c.id);
    toast('Cliente apagado');
    replace('clientes');
  };

  return (
    <section className="stack">
      <TopBar onBack={() => (novo ? go('clientes') : go(`cliente/${c.id}`))} backLabel={novo ? 'Clientes' : 'Cliente'} title={novo ? 'Novo cliente' : 'Editar cliente'} />

      <div className="card form-card">
        <div className="field">
          <label htmlFor="c-nome">Nome</label>
          <input id="c-nome" className="input" autoCapitalize="words" autoComplete="off" value={c.nome} onChange={(e) => { set({ nome: e.target.value }); setErro(''); }} placeholder="Nome do cliente ou da empresa" />
          {erro && <span className="err">{erro}</span>}
        </div>
        <Seg label="Tipo" value={c.tipo} onChange={(tipo) => set({ tipo, documento: '' })} options={[{ value: 'pf', label: 'Pessoa física' }, { value: 'pj', label: 'Empresa' }]} />
        <div className="field">
          <label htmlFor="c-doc">{c.tipo === 'pj' ? 'CNPJ' : 'CPF'} <span className="faint">(opcional)</span></label>
          <input id="c-doc" className="input num" inputMode="numeric" value={c.documento} placeholder={c.tipo === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'} onChange={(e) => set({ documento: c.tipo === 'pj' ? maskCNPJ(e.target.value) : maskCPF(e.target.value) })} />
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="c-tel">Telefone</label><PhoneInput id="c-tel" value={c.telefone} onChange={(telefone) => set({ telefone })} /></div>
          <div className="field"><label htmlFor="c-tel2">Telefone 2</label><PhoneInput id="c-tel2" value={c.telefone2} onChange={(telefone2) => set({ telefone2 })} /></div>
        </div>
      </div>

      {c.enderecos.map((e, i) => (
        <div key={e.id} className="card form-card">
          <h3>
            {c.enderecos.length > 1 ? `Endereço ${i + 1}` : 'Endereço'}
            {i > 0 && <button className="link" onClick={() => set({ enderecos: c.enderecos.filter((_, j) => j !== i) })}>Remover</button>}
          </h3>
          <div className="grid-3-1">
            <div className="field"><label htmlFor={`e-log-${i}`}>Rua / avenida</label><input id={`e-log-${i}`} className="input" autoCapitalize="words" value={e.logradouro} onChange={(ev) => setEnd(i, { logradouro: ev.target.value })} placeholder="Rua Flávio Mesquita" /></div>
            <div className="field"><label htmlFor={`e-num-${i}`}>Número</label><input id={`e-num-${i}`} className="input num" inputMode="numeric" value={e.numero} onChange={(ev) => setEnd(i, { numero: ev.target.value.replace(/[^\dA-Za-z/ -]/g, '') })} placeholder="895" /></div>
          </div>
          <div className="field"><label htmlFor={`e-bai-${i}`}>Bairro</label><input id={`e-bai-${i}`} className="input" autoCapitalize="words" value={e.bairro} onChange={(ev) => setEnd(i, { bairro: ev.target.value })} placeholder="Jardim Cândida" /></div>
          <div className="grid-3-1">
            <div className="field"><label htmlFor={`e-cid-${i}`}>Cidade</label><input id={`e-cid-${i}`} className="input" autoCapitalize="words" value={e.cidade} onChange={(ev) => setEnd(i, { cidade: ev.target.value })} /></div>
            <div className="field"><label htmlFor={`e-uf-${i}`}>UF</label><select id={`e-uf-${i}`} className="input" value={e.uf} onChange={(ev) => setEnd(i, { uf: ev.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor={`e-comp-${i}`}>Complemento <span className="faint">(opcional)</span></label><input id={`e-comp-${i}`} className="input" value={e.complemento} onChange={(ev) => setEnd(i, { complemento: ev.target.value })} placeholder="Fundos, casa 2…" /></div>
        </div>
      ))}
      <button className="chip add" style={{ alignSelf: 'flex-start' }} onClick={() => set({ enderecos: [...c.enderecos, novoEndereco()] })}><Icon name="plus" />Outro endereço</button>

      <div className="card form-card">
        <div className="field"><label htmlFor="c-obs">Observações</label><textarea id="c-obs" className="input" value={c.observacoes} onChange={(e) => set({ observacoes: e.target.value })} placeholder="Ex.: chamar no portão do lado; cliente de confiança" /></div>
      </div>

      <button className="btn primary block" onClick={salvar}><Icon name="check" />{novo ? 'Cadastrar cliente' : 'Salvar alterações'}</button>
      {!novo && <button className="btn block danger" onClick={() => setApagar(true)}><Icon name="trash" />Apagar cliente</button>}
      <Confirm open={apagar} onClose={() => setApagar(false)} title="Apagar este cliente?" text="Essa ação não pode ser desfeita." confirmLabel="Apagar" danger onConfirm={remover} />
    </section>
  );
}
