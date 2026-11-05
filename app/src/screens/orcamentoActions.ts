import { db, getConfig, novoNumeroOrcamento, type Cliente, type Lancamento, type Orcamento, type Pagamento } from '../lib/db';
import { addDias, hojeISO, uid } from '../lib/format';
import { enderecoTexto } from '../lib/calc';

export async function criarOrcamento(cliente?: Cliente | null): Promise<Orcamento> {
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
  await db.orcamentos.add(o);
  return o;
}

/** Registra o pagamento no orçamento e lança a entrada no financeiro. */
export async function registrarPagamento(orc: Orcamento, p: Omit<Pagamento, 'id'>, parcelas: number) {
  const pag: Pagamento = { ...p, id: uid() };
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
    await db.lancamentos.add(lanc);
  });
}

export async function apagarPagamento(orc: Orcamento, pagamentoId: string) {
  await db.transaction('rw', db.orcamentos, db.lancamentos, async () => {
    await db.orcamentos.update(orc.id, { pagamentos: orc.pagamentos.filter((p) => p.id !== pagamentoId), atualizadoEm: new Date().toISOString() });
    await db.lancamentos.where('pagamentoId').equals(pagamentoId).delete();
  });
}

export async function apagarOrcamento(orc: Orcamento) {
  await db.transaction('rw', db.orcamentos, db.lancamentos, async () => {
    await db.lancamentos.where('orcamentoId').equals(orc.id).delete();
    await db.orcamentos.delete(orc.id);
  });
}
