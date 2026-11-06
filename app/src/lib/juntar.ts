import type { Config, Item, Orcamento } from './db';
import { calcular } from './calc';
import { fmtData, r2, uid } from './format';

type Precos = Pick<Config, 'precoMetro' | 'fatorChapa24'>;

/** Pode juntar: não foi juntado, não foi recusado e não tem pagamento. */
export const podeJuntar = (o: Orcamento) => !o.juntadoNo && o.status !== 'recusado' && !o.pagamentos.length;

/** Chave para agrupar orçamentos do mesmo cliente (cadastrado ou só pelo nome). */
export const chaveCliente = (o: Orcamento) => o.clienteId ?? `nome:${o.clienteNome.trim().toLowerCase()}`;

export type Juncao = { itens: Item[]; desconto: number; observacao: string; calheiroIds: string[]; total: number };

/**
 * Junta orçamentos: soma as metragens numa linha só ("Calhas e rufos"), soma os outros itens iguais,
 * soma mão de obra e desconto. O total final é a soma dos totais, até o centavo.
 */
export function juntar(orcs: Orcamento[], cfg: Precos): Juncao {
  const ordenados = [...orcs].sort((a, b) => (a.servicoData ?? a.emitidoEm).localeCompare(b.servicoData ?? b.emitidoEm) || a.numero - b.numero);
  let metros = 0;
  let valorMetros = 0;
  let mao = 0;
  const outros = new Map<string, Item>();
  for (const o of ordenados) {
    const r = calcular(o, cfg);
    for (const l of r.linhas) {
      if (l.item.tipo === 'metro') {
        metros += l.item.quantidade;
        valorMetros += l.total;
      } else if (l.item.tipo === 'mao') {
        mao += l.total;
      } else {
        const k = `${l.item.descricao.trim().toLowerCase()}|${l.item.unidade}|${l.item.precoUnit}`;
        const ex = outros.get(k);
        if (ex) ex.quantidade = r2(ex.quantidade + l.item.quantidade);
        else outros.set(k, { ...l.item, id: uid() });
      }
    }
  }
  metros = r2(metros);
  valorMetros = r2(valorMetros);
  const itens: Item[] = [];
  if (metros > 0)
    itens.push({ id: uid(), tipo: 'metro', descricao: 'Calhas e rufos', unidade: 'm', quantidade: metros, corte: null, chapa: 26, precoManual: true, precoUnit: valorMetros / metros });
  itens.push(...outros.values());
  if (mao > 0) itens.push({ id: uid(), tipo: 'mao', catalogo: 'mao', descricao: 'Mão de obra', unidade: 'un', quantidade: 1, precoUnit: r2(mao) });

  const lista = ordenados.map((o) => `nº ${o.numero} (${fmtData(o.servicoData ?? o.emitidoEm)})`);
  const ultimo = lista.pop();
  const observacao = `Este orçamento reúne ${ordenados.length} orçamentos: ${lista.length ? `${lista.join(', ')} e ${ultimo}` : ultimo}.`;
  const desconto = r2(ordenados.reduce((s, o) => s + (o.desconto || 0), 0));
  const calheiroIds = [...new Set(ordenados.flatMap((o) => o.calheiroIds))];
  const total = r2(ordenados.reduce((s, o) => s + calcular(o, cfg).total, 0));
  return { itens, desconto, observacao, calheiroIds, total };
}
