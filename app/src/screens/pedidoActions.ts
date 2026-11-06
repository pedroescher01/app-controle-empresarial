import { db, type Fornecedor, type Pedido } from '../lib/db';
import { bobinasParaComprar, estadoBobina, idBobina } from '../lib/bobinas';
import { hojeISO, uid } from '../lib/format';

const agora = () => new Date().toISOString();

/** Toque na bobina: ok ⇄ comprar. Bobina já pedida não muda (só quando o pedido chega). */
export async function alternarBobina(chapa: 24 | 26, corte: number) {
  const [bobinas, pedidos] = await Promise.all([db.bobinas.toArray(), db.pedidos.toArray()]);
  const e = estadoBobina(bobinas, pedidos, chapa, corte);
  if (e === 'pedida') return e;
  const novo = e === 'ok' ? 'comprar' : 'ok';
  await db.bobinas.put({ id: idBobina(chapa, corte), chapa, corte, estado: novo, atualizadoEm: agora() });
  return novo;
}

/** Cria um pedido "a pedir" com todas as bobinas marcadas para comprar. */
export async function montarPedido(fornecedorId: string | null): Promise<Pedido> {
  const [bobinas, pedidos] = await Promise.all([db.bobinas.toArray(), db.pedidos.toArray()]);
  const p: Pedido = {
    id: uid(),
    numero: pedidos.reduce((m, x) => Math.max(m, x.numero), 0) + 1,
    fornecedorId,
    itens: bobinasParaComprar(bobinas, pedidos),
    observacoes: '',
    pedidoEm: null, notaEm: null, chegouEm: null, pagoEm: null,
    valorTotal: null, pesoKg: null, precoKg26: null, precoKg24: null,
    formaPagamento: 'Pix', contaPagamento: 'Sicoob',
    criadoEm: agora(), atualizadoEm: agora(),
  };
  await db.pedidos.add(p);
  return p;
}

export const salvarPedido = (id: string, patch: Partial<Pedido>) => db.pedidos.update(id, { ...patch, atualizadoEm: agora() });

/** Chegou: as bobinas do pedido voltam a ter no estoque. */
export async function marcarChegou(p: Pedido, data = hojeISO()) {
  await db.transaction('rw', db.pedidos, db.bobinas, async () => {
    await db.pedidos.update(p.id, { chegouEm: data, atualizadoEm: agora() });
    await db.bobinas.bulkPut(p.itens.map((i) => ({ id: idBobina(i.chapa, i.corte), chapa: i.chapa, corte: i.corte, estado: 'ok' as const, atualizadoEm: agora() })));
  });
}

/** Desfaz a chegada: as bobinas voltam a ficar "pedidas". */
export async function desfazerChegada(p: Pedido) {
  await db.transaction('rw', db.pedidos, db.bobinas, async () => {
    await db.pedidos.update(p.id, { chegouEm: null, atualizadoEm: agora() });
    await db.bobinas.bulkPut(p.itens.map((i) => ({ id: idBobina(i.chapa, i.corte), chapa: i.chapa, corte: i.corte, estado: 'comprar' as const, atualizadoEm: agora() })));
  });
}

/** Pago: vira saída no financeiro (categoria Fornecedor). */
export async function marcarPago(p: Pedido, f: Fornecedor | null | undefined, pg: { data: string; valor: number; forma: string; conta: string }) {
  await db.transaction('rw', db.pedidos, db.lancamentos, async () => {
    await db.lancamentos.where('pedidoId').equals(p.id).delete();
    await db.lancamentos.add({
      id: uid(), tipo: 'saida', data: pg.data, valor: pg.valor,
      descricao: `Pedido de bobinas nº ${p.numero}${f ? ` · ${f.nome}` : ''}`,
      categoria: 'Fornecedor', forma: pg.forma, conta: pg.conta, pedidoId: p.id, criadoEm: agora(),
    });
    await db.pedidos.update(p.id, { pagoEm: pg.data, valorTotal: p.valorTotal ?? pg.valor, formaPagamento: pg.forma, contaPagamento: pg.conta, atualizadoEm: agora() });
  });
}

export async function desfazerPagamento(p: Pedido) {
  await db.transaction('rw', db.pedidos, db.lancamentos, async () => {
    await db.lancamentos.where('pedidoId').equals(p.id).delete();
    await db.pedidos.update(p.id, { pagoEm: null, atualizadoEm: agora() });
  });
}

export async function apagarPedido(p: Pedido) {
  await db.transaction('rw', db.pedidos, db.lancamentos, async () => {
    await db.lancamentos.where('pedidoId').equals(p.id).delete();
    await db.pedidos.delete(p.id);
  });
}
