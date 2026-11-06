import { db, getConfig, novoNumeroOrcamento, type Cliente, type Lancamento, type Orcamento, type Pagamento, type Visita } from '../lib/db';
import { addDias, hojeISO, uid } from '../lib/format';
import { enderecoTexto } from '../lib/calc';
import { DIRETO_CALHEIRO } from '../lib/catalog';
import { juntar } from '../lib/juntar';

/** Cria o orçamento já completo numa gravação só (a tela nunca abre com ele pela metade). */
export async function criarOrcamento(cliente?: Cliente | null, extra: Partial<Orcamento> = {}): Promise<Orcamento> {
  const cfg = await getConfig();
  const hoje = hojeISO();
  const agora = new Date().toISOString();
  const o: Orcamento = {
    id: uid(),
    numero: await novoNumeroOrcamento(),
    clienteId: cliente?.id ?? null,
    clienteNome: cliente?.nome ?? '',
    telefone: cliente ? cliente.telefone || cliente.telefone2 : '',
    endereco: cliente?.enderecos[0] ? enderecoTexto(cliente.enderecos[0]) : '',
    calheiroIds: [],
    modo: 'simples',
    itens: [],
    desconto: 0,
    totalDesejado: null,
    valorAVista: null,
    observacoes: '',
    status: 'rascunho',
    emitidoEm: hoje,
    validoAte: addDias(hoje, cfg.validadeDias),
    enviadoEm: null,
    aprovadoEm: null,
    parcelas: 1,
    pagamentos: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
  Object.assign(o, extra);
  await db.orcamentos.add(o);
  return o;
}

/** Registra o pagamento no orçamento e lança a entrada no financeiro. */
export async function registrarPagamento(orc: Orcamento, p: Omit<Pagamento, 'id'>, parcelas: number) {
  const pag: Pagamento = { ...p, id: uid() };
  const cfg = await getConfig();
  const pct = p.forma === 'Cartão de crédito' ? cfg.taxaCredito : p.forma === 'Cartão de débito' ? cfg.taxaDebito : 0;
  const lanc: Lancamento = {
    id: uid(),
    tipo: 'entrada',
    data: p.data,
    valor: p.valor,
    descricao: `Orçamento ${orc.numero} · ${orc.clienteNome}`,
    categoria: 'Orçamento',
    forma: p.forma,
    conta: p.conta,
    orcamentoId: orc.id,
    pagamentoId: pag.id,
    taxa: pct ? Math.round(p.valor * pct) / 100 : undefined,
    criadoEm: new Date().toISOString(),
  };
  await db.transaction('rw', db.orcamentos, db.lancamentos, async () => {
    await db.orcamentos.update(orc.id, {
      pagamentos: [...orc.pagamentos, pag],
      parcelas: Math.max(parcelas, orc.pagamentos.length + 1),
      status: orc.status === 'rascunho' || orc.status === 'enviado' ? 'aprovado' : orc.status,
      aprovadoEm: orc.aprovadoEm ?? p.data,
      atualizadoEm: new Date().toISOString(),
    });
    // pago direto ao calheiro: o dinheiro não passou pela empresa, então não entra no financeiro
    if (p.forma !== DIRETO_CALHEIRO) await db.lancamentos.add(lanc);
  });
}

export async function apagarPagamento(orc: Orcamento, pagamentoId: string) {
  await db.transaction('rw', db.orcamentos, db.lancamentos, async () => {
    await db.orcamentos.update(orc.id, { pagamentos: orc.pagamentos.filter((p) => p.id !== pagamentoId), atualizadoEm: new Date().toISOString() });
    await db.lancamentos.where('pagamentoId').equals(pagamentoId).delete();
  });
}

export async function apagarOrcamento(orc: Orcamento) {
  await db.transaction('rw', db.orcamentos, db.lancamentos, db.adiantamentos, async () => {
    await db.lancamentos.where('orcamentoId').equals(orc.id).delete();
    // material descontado neste orçamento volta para o saldo do calheiro
    await db.adiantamentos.where('orcamentoId').equals(orc.id).delete();
    await db.orcamentos.delete(orc.id);
  });
}

/** Orçamento novo já com cliente, endereço, telefone e calheiro da visita; liga a visita ao orçamento. */
export async function criarOrcamentoDaVisita(v: Visita): Promise<Orcamento> {
  const cliente = v.clienteId ? (await db.clientes.get(v.clienteId)) ?? null : null;
  const e = cliente?.enderecos.find((x) => enderecoTexto(x));
  const o = await criarOrcamento(cliente, {
    clienteId: cliente?.id ?? null,
    clienteNome: cliente?.nome ?? v.nome,
    telefone: v.telefone || (cliente ? cliente.telefone || cliente.telefone2 : ''),
    endereco: v.endereco || (e ? enderecoTexto(e) : ''),
    calheiroIds: v.calheiroId ? [v.calheiroId] : [],
  });
  await db.visitas.update(v.id, { orcamentoId: o.id, status: 'medido', medidoEm: v.medidoEm ?? hojeISO(), atualizadoEm: new Date().toISOString() });
  return o;
}

/** Junta orçamentos num novo (emitido hoje). Os antigos ficam marcados como "Juntado". */
export async function juntarOrcamentos(orcs: Orcamento[]): Promise<Orcamento> {
  const cfg = await getConfig();
  const recente = [...orcs].sort((a, b) => b.emitidoEm.localeCompare(a.emitidoEm))[0];
  const cliente = recente.clienteId ? (await db.clientes.get(recente.clienteId)) ?? null : null;
  const j = juntar(orcs, cfg);
  const patch: Partial<Orcamento> = {
    clienteId: recente.clienteId,
    clienteNome: recente.clienteNome,
    telefone: orcs.find((o) => o.telefone)?.telefone ?? '',
    endereco: recente.endereco,
    calheiroIds: j.calheiroIds,
    itens: j.itens,
    desconto: j.desconto,
    observacoes: j.observacao,
    modo: orcs.every((o) => o.modo === 'detalhado') ? 'detalhado' : 'simples',
  };
  const novo = await criarOrcamento(cliente, patch);
  await db.transaction('rw', db.orcamentos, async () => {
    for (const o of orcs) await db.orcamentos.update(o.id, { juntadoNo: novo.id, atualizadoEm: new Date().toISOString() });
  });
  return novo;
}

/** Desfaz a junção: apaga o orçamento novo e libera os antigos. */
export async function separarJuncao(novo: Orcamento) {
  await db.transaction('rw', db.orcamentos, async () => {
    await db.orcamentos.where('id').anyOf((await db.orcamentos.toArray()).filter((o) => o.juntadoNo === novo.id).map((o) => o.id)).modify({ juntadoNo: null });
    await db.orcamentos.delete(novo.id);
  });
}
