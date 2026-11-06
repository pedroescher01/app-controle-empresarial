import type { Bobina, Fornecedor, ItemPedido, NivelProducao, Pedido } from './db';
import { CORTES_BOBINA } from './catalog';
import { dec2, fmtData } from './format';

export const CHAPAS = [26, 24] as const;
export const ESPESSURA: Record<24 | 26, string> = { 26: '0,47 mm', 24: '0,60 mm' };
export const idBobina = (chapa: 24 | 26, corte: number) => `${chapa}-${corte}`;

export type EstadoBobina = 'ok' | 'comprar' | 'pedida';

/** Pedido já mandado ao fornecedor e que ainda não chegou. */
export const pedidoAberto = (p: Pedido) => !!p.pedidoEm && !p.chegouEm;
/** Pedido montado mas ainda não mandado. */
export const pedidoRascunho = (p: Pedido) => !p.pedidoEm;

const tem = (itens: ItemPedido[], chapa: number, corte: number) => itens.some((i) => i.chapa === chapa && i.corte === corte);

export function estadoBobina(bobinas: Bobina[], pedidos: Pedido[], chapa: 24 | 26, corte: number): EstadoBobina {
  if (pedidos.some((p) => pedidoAberto(p) && tem(p.itens, chapa, corte))) return 'pedida';
  return bobinas.find((b) => b.id === idBobina(chapa, corte))?.estado ?? 'ok';
}

/** Bobinas marcadas "comprar" que ainda não estão em nenhum pedido (aberto ou rascunho). */
export function bobinasParaComprar(bobinas: Bobina[], pedidos: Pedido[]): ItemPedido[] {
  const out: ItemPedido[] = [];
  for (const chapa of CHAPAS)
    for (const corte of CORTES_BOBINA) {
      if (estadoBobina(bobinas, pedidos, chapa, corte) !== 'comprar') continue;
      if (pedidos.some((p) => pedidoRascunho(p) && tem(p.itens, chapa, corte))) continue;
      out.push({ chapa, corte, quantidade: 1 });
    }
  return out;
}

export type StatusPedido = { rotulo: string; cor: 'mute' | 'info' | 'warn' | 'ok' | 'red'; etapa: number };

export function statusPedido(p: Pedido): StatusPedido {
  if (p.chegouEm && p.pagoEm) return { rotulo: 'Concluído', cor: 'ok', etapa: 4 };
  if (p.chegouEm) return { rotulo: 'Chegou · falta pagar', cor: 'red', etapa: 3 };
  if (p.pagoEm) return { rotulo: 'Pago · falta chegar', cor: 'warn', etapa: 3 };
  if (p.notaEm) return { rotulo: 'Nota recebida', cor: 'info', etapa: 2 };
  if (p.pedidoEm) return { rotulo: 'Pedido · aguardando carga', cor: 'info', etapa: 1 };
  return { rotulo: 'A pedir', cor: 'warn', etapa: 0 };
}

export const descricaoItem = (i: ItemPedido) => `${i.quantidade} bobina${i.quantidade > 1 ? 's' : ''} corte ${i.corte} · chapa ${i.chapa} (${ESPESSURA[i.chapa]})`;

/** Mensagem pronta para o WhatsApp do vendedor. */
export function mensagemPedido(p: Pedido, f: Fornecedor | null | undefined) {
  const ola = f?.vendedor ? `Olá, ${f.vendedor.split(' ')[0]}!` : 'Olá!';
  const linhas = ordenarItens(p.itens).map((i) => `• ${descricaoItem(i)}`);
  return [
    `${ola} Aqui é o Pedro, da Calhas Andrade (Araras).`,
    'Gostaria de fazer um pedido de bobinas galvanizadas:',
    '',
    ...linhas,
    ...(p.observacoes.trim() ? ['', p.observacoes.trim()] : []),
    '',
    'Quando fechar a carga, me avisa e manda a nota, por favor. Obrigado!',
  ].join('\n');
}

export const ordenarItens = (itens: ItemPedido[]) => [...itens].sort((a, b) => b.chapa - a.chapa || a.corte - b.corte);

export type PontoPreco = { data: string; chapa: 24 | 26; precoKg: number; pedido: number; fornecedorId: string | null };

/** Histórico do preço do quilo, pela data da nota (ou do pedido). */
export function historicoPreco(pedidos: Pedido[]): PontoPreco[] {
  const pts: PontoPreco[] = [];
  for (const p of pedidos) {
    const data = p.notaEm ?? p.chegouEm ?? p.pedidoEm;
    if (!data) continue;
    if (p.precoKg26) pts.push({ data, chapa: 26, precoKg: p.precoKg26, pedido: p.numero, fornecedorId: p.fornecedorId });
    if (p.precoKg24) pts.push({ data, chapa: 24, precoKg: p.precoKg24, pedido: p.numero, fornecedorId: p.fornecedorId });
  }
  // mesma data: o pedido de número maior é o mais novo
  return pts.sort((a, b) => a.data.localeCompare(b.data) || a.pedido - b.pedido);
}

/** "subiu 4,3%" comparando o último preço com o anterior da mesma chapa. */
export function variacao(pts: PontoPreco[], chapa: 24 | 26) {
  const s = pts.filter((p) => p.chapa === chapa);
  if (s.length < 2) return null;
  const a = s[s.length - 2].precoKg;
  const b = s[s.length - 1].precoKg;
  const pct = ((b - a) / a) * 100;
  return { de: a, para: b, pct, texto: `${pct > 0 ? 'subiu' : pct < 0 ? 'caiu' : 'igual'}${pct ? ` ${dec2(Math.abs(pct)).replace(/,00$/, '')}%` : ''}` };
}

export const resumoPedido = (p: Pedido) => {
  const n = p.itens.reduce((s, i) => s + i.quantidade, 0);
  return `${n} bobina${n === 1 ? '' : 's'}${p.pedidoEm ? ` · pedido em ${fmtData(p.pedidoEm)}` : ''}`;
};

// ---------- prioridade de compra ----------
export const NIVEIS: { k: NivelProducao; l: string; barras: number }[] = [
  { k: 'bastante', l: 'Bastante', barras: 4 },
  { k: 'medio', l: 'Médio', barras: 3 },
  { k: 'afinando', l: 'Afinando', barras: 2 },
  { k: 'acabando', l: 'Acabando', barras: 1 },
];

/**
 * urgente = não tem no estoque e a da produção está afinando/acabando
 * repor   = não tem no estoque, mas a da produção ainda tem bastante/médio
 * olho    = tem no estoque, mas a da produção está acabando (logo abre a do estoque)
 */
export type Prioridade = 'pedida' | 'urgente' | 'repor' | 'olho' | 'ok';

export function prioridade(bobinas: Bobina[], pedidos: Pedido[], chapa: 24 | 26, corte: number): Prioridade {
  const e = estadoBobina(bobinas, pedidos, chapa, corte);
  if (e === 'pedida') return 'pedida';
  const nivel = bobinas.find((b) => b.id === idBobina(chapa, corte))?.producao ?? 'bastante';
  if (e === 'comprar') return nivel === 'afinando' || nivel === 'acabando' ? 'urgente' : 'repor';
  return nivel === 'acabando' ? 'olho' : 'ok';
}

export const nivelBobina = (bobinas: Bobina[], chapa: 24 | 26, corte: number): NivelProducao =>
  bobinas.find((b) => b.id === idBobina(chapa, corte))?.producao ?? 'bastante';

export function listaPrioridade(bobinas: Bobina[], pedidos: Pedido[]) {
  const out: Record<Exclude<Prioridade, 'ok'>, ItemPedido[]> = { urgente: [], repor: [], olho: [], pedida: [] };
  for (const chapa of CHAPAS)
    for (const corte of CORTES_BOBINA) {
      const p = prioridade(bobinas, pedidos, chapa, corte);
      if (p !== 'ok') out[p].push({ chapa, corte, quantidade: 1 });
    }
  return out;
}

// ---------- peso das bobinas ----------
export type PesoCorte = { chapa: 24 | 26; corte: number; media: number; min: number; max: number; n: number };

/** Pesos de cada bobina já registrados nas notas, por chapa e corte. */
export function pesosPorCorte(pedidos: Pedido[]): PesoCorte[] {
  const m = new Map<string, number[]>();
  for (const p of pedidos)
    for (const i of p.itens)
      for (const kg of i.pesos ?? []) {
        if (!(kg > 0)) continue;
        const k = idBobina(i.chapa, i.corte);
        m.set(k, [...(m.get(k) ?? []), kg]);
      }
  return [...m.entries()]
    .map(([k, v]) => {
      const [chapa, corte] = k.split('-').map(Number) as [24 | 26, number];
      return { chapa, corte, media: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v), n: v.length };
    })
    .sort((a, b) => b.chapa - a.chapa || a.corte - b.corte);
}

/** Quilos por centímetro de largura (média de todas as bobinas da chapa) — serve para cortes ainda sem histórico. */
export function kgPorCm(pesos: PesoCorte[], chapa: 24 | 26): number | null {
  let kg = 0, cm = 0;
  for (const x of pesos) if (x.chapa === chapa) { kg += x.media * x.n; cm += x.corte * x.n; }
  return cm ? kg / cm : null;
}

/** Peso esperado de uma bobina: média do corte; sem histórico do corte, pela largura. */
export function pesoEsperado(pesos: PesoCorte[], chapa: 24 | 26, corte: number): { kg: number; pelaLargura: boolean } | null {
  const x = pesos.find((p) => p.chapa === chapa && p.corte === corte);
  if (x) return { kg: x.media, pelaLargura: false };
  const k = kgPorCm(pesos, chapa);
  return k ? { kg: k * corte, pelaLargura: true } : null;
}

/** Bobina fora do normal: mais de 10% de diferença da média do corte. */
export function foraDoNormal(pesos: PesoCorte[], chapa: 24 | 26, corte: number, kg: number) {
  const e = pesoEsperado(pesos, chapa, corte);
  if (!e || !kg) return null;
  const pct = ((kg - e.kg) / e.kg) * 100;
  if (Math.abs(pct) < 10) return null;
  return { pct, texto: `${pct < 0 ? 'veio leve' : 'veio pesada'}: ${dec2(Math.abs(pct)).replace(/,00$/, '')}% ${pct < 0 ? 'abaixo' : 'acima'} da média (${dec2(e.kg).replace(/,00$/, '')} kg)` };
}

/** Último preço do kg registrado para a chapa. */
export const ultimoPrecoKg = (pedidos: Pedido[], chapa: 24 | 26) => historicoPreco(pedidos).filter((p) => p.chapa === chapa).pop()?.precoKg ?? null;

/** Previsão de peso e valor do pedido pelas médias (ignora o próprio pedido). */
export function previsaoPedido(p: Pedido, pedidos: Pedido[]) {
  const outros = pedidos.filter((x) => x.id !== p.id);
  const pesos = pesosPorCorte(outros);
  let kg = 0, valor = 0, semPeso = 0, semPreco = false, pelaLargura = false;
  for (const i of p.itens) {
    const e = pesoEsperado(pesos, i.chapa, i.corte);
    if (!e) { semPeso += i.quantidade; continue; }
    if (e.pelaLargura) pelaLargura = true;
    const k = e.kg * i.quantidade;
    kg += k;
    const preco = ultimoPrecoKg(outros, i.chapa);
    if (preco) valor += k * preco; else semPreco = true;
  }
  if (!kg) return null;
  return { kg, valor: semPreco ? null : valor, semPeso, pelaLargura };
}
