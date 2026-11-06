import type { Adiantamento, Item } from './db';
import { r2, semAcento } from './format';

/** Chave do item para casar o material adiantado com o item do orçamento. */
export const chaveItem = (i: Pick<Item, 'catalogo' | 'descricao'>) =>
  i.catalogo && i.catalogo !== 'livre' ? i.catalogo : `desc:${semAcento(i.descricao.trim())}`;

export type Saldo = { chave: string; descricao: string; saldo: number };

/** Saldo de cada material com o calheiro (só o que ainda tem). */
export function saldos(movs: Adiantamento[], calheiroId: string): Saldo[] {
  const m = new Map<string, Saldo>();
  for (const a of movs.filter((x) => x.calheiroId === calheiroId)) {
    const s = m.get(a.chave) ?? { chave: a.chave, descricao: a.descricao, saldo: 0 };
    s.saldo = r2(s.saldo + a.quantidade);
    if (a.quantidade > 0) s.descricao = a.descricao;
    m.set(a.chave, s);
  }
  return [...m.values()].filter((s) => s.saldo > 0).sort((a, b) => a.descricao.localeCompare(b.descricao));
}

export type Sugestao = { calheiroId: string; chave: string; descricao: string; saldo: number; noOrcamento: number; jaDescontado: number; sugerido: number };

/** Para cada calheiro do orçamento e cada item que ele tem adiantado, quanto dá para descontar. */
export function sugestoes(movs: Adiantamento[], calheiroIds: string[], itens: Item[], orcamentoId: string): Sugestao[] {
  const out: Sugestao[] = [];
  for (const cid of calheiroIds) {
    const doOrc = movs.filter((a) => a.calheiroId === cid && a.orcamentoId === orcamentoId);
    const chaves = new Set([...saldos(movs, cid).map((s) => s.chave), ...doOrc.map((a) => a.chave)]);
    for (const chave of chaves) {
      const noOrcamento = r2(itens.filter((i) => chaveItem(i) === chave).reduce((s, i) => s + i.quantidade, 0));
      const jaDescontado = r2(-doOrc.filter((a) => a.chave === chave).reduce((s, a) => s + a.quantidade, 0));
      if (!noOrcamento && !jaDescontado) continue;
      const saldo = saldos(movs, cid).find((s) => s.chave === chave)?.saldo ?? 0;
      const descricao = movs.find((a) => a.calheiroId === cid && a.chave === chave)?.descricao ?? chave;
      out.push({ calheiroId: cid, chave, descricao, saldo, noOrcamento, jaDescontado, sugerido: Math.max(0, Math.min(saldo, r2(noOrcamento - jaDescontado))) });
    }
  }
  return out;
}

export const plural = (n: number, desc: string) => `${String(n).replace('.', ',')} ${desc.toLowerCase()}${n === 1 || /s$/i.test(desc) ? '' : 's'}`;
