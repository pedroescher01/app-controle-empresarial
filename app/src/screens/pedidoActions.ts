import { db, type Fornecedor, type ItemPedido, type Pedido } from '../lib/db';
import { bobinasParaComprar, estadoBobina, idBobina } from '../lib/bobinas';
import { hojeISO, uid } from '../lib/format';

const agora = () => new Date().toISOString();

/** Toque na bobina: ok ⇄ comprar. Bobina já pedida não muda (só quando o pedido chega). */
export async function alternarBobina(chapa: 24 | 26, corte: number) {
  const [bobinas, pedidos] = await Promise.all([db.bobinas.toArray(), db.pedidos.toArray()]);
  const e = estadoBobina(bobinas, pedidos, chapa, corte);
  if (e === 'pedida') return e;
  const novo = e === 'ok' ? 'comprar' : 'ok';
  const atual = bobinas.find((b) => b.id === idBobina(chapa, corte));
  await db.bobinas.put({ ...atual, id: idBobina(chapa, corte), chapa, corte, estado: novo, atualizadoEm: agora() });
  return novo;
}

/** Cria um pedido "a pedir" com todas as bobinas marcadas para comprar. */
export async function montarPedido(fornecedorId: string | null, so?: ItemPedido[]): Promise<Pedido> {
  const [bobinas, pedidos] = await Promise.all([db.bobinas.toArray(), db.pedidos.toArray()]);
  const p: Pedido = {
    id: uid(),
    numero: pedidos.reduce((m, x) => Math.max(m, x.numero), 0) + 1,
    fornecedorId,
    itens: so ?? bobinasParaComprar(bobinas, pedidos),
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
    await guardarEstoque(p, 'ok');
  });
}

/** Desfaz a chegada: as bobinas voltam a ficar "pedidas". */
export async function desfazerChegada(p: Pedido) {
  await db.transaction('rw', db.pedidos, db.bobinas, async () => {
    await db.pedidos.update(p.id, { chegouEm: null, atualizadoEm: agora() });
    await guardarEstoque(p, 'comprar');
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

/** Muda só o "tem no estoque" das bobinas do pedido, sem mexer no nível da produção. */
async function guardarEstoque(p: Pedido, estado: 'ok' | 'comprar') {
  const atuais = await db.bobinas.bulkGet(p.itens.map((i) => idBobina(i.chapa, i.corte)));
  await db.bobinas.bulkPut(p.itens.map((i, k) => ({ ...atuais[k], id: idBobina(i.chapa, i.corte), chapa: i.chapa, corte: i.corte, estado, atualizadoEm: agora() })));
}

/** Conferência: estoque e nível da produção de uma bobina. */
export async function conferirBobina(chapa: 24 | 26, corte: number, patch: { estado?: 'ok' | 'comprar'; producao?: import('../lib/db').NivelProducao }) {
  const atual = await db.bobinas.get(idBobina(chapa, corte));
  await db.bobinas.put({ estado: 'ok', ...atual, ...patch, id: idBobina(chapa, corte), chapa, corte, atualizadoEm: agora() });
}
