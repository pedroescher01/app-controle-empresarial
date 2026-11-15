import type { Item, Orcamento, PadraoDesenho, Peca } from './db';
import { CORTES_BOBINA } from './catalog';
import { r2, uid } from './format';

/**
 * Contas da folha de desenho (usada no computador).
 * Cada peça desenhada é uma sequência de abas; o corte é a soma das abas.
 * A peça com medidas e metragem vira um item por metro do orçamento (ligado por `pecaId`),
 * então preço, "Fechar em", PDF e todo o resto continuam sendo os do orçamento normal.
 */

const fmtBR = (n: number, dec = 0, max = dec) => n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: max });

/** aceita "17,5", "5.30", "1.160" (mil cento e sessenta) e "1.300,00" */
export function numero(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').trim().replace(/\s|R\$/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}
export const fmtMed = (v: number) => fmtBR(r2(v), 0, 2);

export type Medida = { a: number; b: number; txt: string };
/** "13" → 13;  "13/10" → cônica (13 numa ponta, 10 na outra);  "17,5" → 17,5 */
export function parseMed(str: string | null | undefined): Medida | null {
  if (str == null) return null;
  const partes = String(str).trim().split('/');
  if (partes.length > 2) return null;
  const ns = partes.map(numero);
  if (ns.some((n) => !(n > 0))) return null;
  const a = ns[0];
  const b = ns.length === 2 ? ns[1] : ns[0];
  return { a, b, txt: a === b ? fmtMed(a) : `${fmtMed(a)}/${fmtMed(b)}` };
}

/** Corte real = soma das abas. Peça cônica tem um corte para cada ponta. */
export function corteReal(p: Pick<Peca, 'med'>) {
  let a = 0;
  let b = 0;
  let completo = p.med.length > 0;
  let tem = false;
  for (const m of p.med) {
    const x = parseMed(m);
    if (!x) { completo = false; continue; }
    a += x.a; b += x.b; tem = true;
  }
  a = r2(a); b = r2(b);
  return { a, b, maior: Math.max(a, b), conica: a !== b, completo, tem };
}

const CORTES_CHEIOS = CORTES_BOBINA.filter((c) => c < 120);
/** Corte que cobra: sobe para o corte de cima; acima de 65 vai de 5 em 5 (sai da bobina de 120). */
export function corteCobrado(c: number): number {
  if (!(c > 0)) return 0;
  for (const k of CORTES_CHEIOS) if (c <= k + 1e-9) return k;
  return Math.ceil((c - 1e-9) / 5) * 5;
}
/** De qual bobina sai: a do corte que cobra; de 70 para cima, da bobina inteira (120). */
export const bobinaDoCorte = (cobrado: number) => (cobrado > CORTES_CHEIOS[CORTES_CHEIOS.length - 1] ? 120 : cobrado);

export type GrupoMetr = { n: number; v: number };
/** "5,30" → uma peça;  "9+2" → 9,00 e 2,00;  "4x2,5" → quatro peças de 2,50 */
export function gruposMetr(str: string | null | undefined): GrupoMetr[] {
  const s = String(str ?? '').replace(/\s/g, '');
  if (!s) return [];
  const gs: GrupoMetr[] = [];
  for (const parte of s.split('+')) {
    const m = /^(?:(\d+)[x×*])?(.+)$/i.exec(parte);
    if (!m) return [];
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const v = numero(m[2]);
    if (!(n > 0) || n > 500 || !(v > 0)) return [];
    gs.push({ n, v });
  }
  return gs;
}
export const fmtGrupo = (g: GrupoMetr) => (g.n > 1 ? `${g.n} × ` : '') + fmtBR(g.v, 2);
export const fmtGrupos = (gs: GrupoMetr[]) => gs.map(fmtGrupo).join(' + ');
export const somaMetr = (str: string | null | undefined) => r2(gruposMetr(str).reduce((s, g) => s + g.n * g.v, 0));

/** Marcações para bater na chapa: soma acumulada das abas (cônica: uma linha para cada ponta). */
export function batidas(p: Pick<Peca, 'med' | 'flip'>): string[] | null {
  let ms = p.med.map(parseMed);
  if (!ms.length || ms.some((m) => !m)) return null;
  if (p.flip) ms = ms.slice().reverse();
  const linha = (k: 'a' | 'b') => {
    let s = 0;
    return ms.map((m) => { s += m![k]; return fmtMed(s); }).join(' · ');
  };
  const c = corteReal(p);
  return c.conica ? [`C/${fmtMed(c.a)}:  ${linha('a')}`, `C/${fmtMed(c.b)}:  ${linha('b')}`] : [linha('a')];
}

/** Nome da peça → item do catálogo (para o desconto de material e o resto do sistema reconhecerem). */
function catalogoDoNome(nome: string): { catalogo: string; descricao: string } {
  const n = nome.trim().toLowerCase();
  if (!n) return { catalogo: 'calhas_rufos', descricao: 'Calhas e rufos' };
  if (n === 'calha') return { catalogo: 'calha', descricao: 'Calha' };
  if (n === 'rufo') return { catalogo: 'rufo', descricao: 'Rufo' };
  if (n === 'pingadeira') return { catalogo: 'pingadeira', descricao: 'Pingadeira' };
  return { catalogo: 'livre', descricao: nome.trim() };
}

/** A peça já pode virar item? Precisa de todas as medidas, metragem e caber numa bobina. */
export function pecaPronta(p: Peca) {
  const c = corteReal(p);
  const cobrado = corteCobrado(c.maior);
  const metros = somaMetr(p.metr);
  return { ok: p.pts.length >= 2 && c.completo && metros > 0 && cobrado <= 120, corte: c, cobrado, metros };
}

/**
 * Deixa os itens do orçamento de acordo com as peças desenhadas:
 * peça pronta → item por metro (quantidade = metragem, corte = o que cobra); peça apagada → item sai.
 * Itens digitados à mão (sem `pecaId`) nunca são tocados. A chapa (24/26) escolhida no item é mantida.
 */
export function sincronizarItens(itens: Item[], pecas: Peca[]): Item[] {
  const porPeca = new Map(pecas.map((p) => [p.id, p]));
  const usados = new Set<string>();
  const out: Item[] = [];
  for (const it of itens) {
    if (!it.pecaId) { out.push(it); continue; }
    const p = porPeca.get(it.pecaId);
    const pr = p ? pecaPronta(p) : null;
    if (!p || !pr || !pr.ok) continue; // a peça saiu ou ficou incompleta: o item sai junto
    usados.add(p.id);
    const nome = p.nome.trim() ? catalogoDoNome(p.nome) : { catalogo: it.catalogo ?? 'calhas_rufos', descricao: it.descricao };
    out.push({ ...it, ...nome, tipo: 'metro', unidade: 'm', quantidade: pr.metros, corte: pr.cobrado, precoManual: undefined });
  }
  for (const p of pecas) {
    if (usados.has(p.id)) continue;
    const pr = pecaPronta(p);
    if (!pr.ok) continue;
    out.push({ id: uid(), pecaId: p.id, tipo: 'metro', ...catalogoDoNome(p.nome), unidade: 'm', quantidade: pr.metros, corte: pr.cobrado, chapa: 26, precoUnit: 0 });
  }
  return out;
}

/** Mudou alguma coisa que interessa nos itens? (para não regravar o orçamento à toa) */
export const itensIguais = (a: Item[], b: Item[]) => JSON.stringify(a) === JSON.stringify(b);

/** A "jogada": soma 5% e arredonda para cima de 10 em 10. Vira o "Fechar em" do orçamento. */
export function valorDaJogada(subtotalBase: number, pct = 5, passo = 10): number | null {
  if (!(subtotalBase > 0)) return null;
  return Math.ceil(r2(subtotalBase * (1 + pct / 100)) / passo - 1e-9) * passo;
}

/**
 * Jeitos de desenhar que já vêm prontos (tirados das folhas de papel do Pedro).
 * Ele apaga o que não quiser e salva o jeito dele por cima com F8 (mesmo nome substitui).
 */
export const PADROES_INICIAIS: PadraoDesenho[] = [
  { id: 'p-ping-dupla', nome: 'Pingadeira dupla', pts: [[2, 6], [0, 4], [0, 0], [14, 0], [14, 4], [12, 6]], med: ['2', '4', '20', '4', '2'] },
  { id: 'p-ping-encosto', nome: 'Pingadeira de encosto', pts: [[1, 0], [0, 2], [0, 4], [13, 6], [13, 10], [11, 12]], med: ['1', '3', '13', '4', '2'] },
  { id: 'p-rufo-encosto', nome: 'Rufo de encosto', pts: [[1, 0], [0, 2], [0, 4], [15, 7], [15, 9]], med: ['1', '3', '15', '3'] },
  { id: 'p-rufo', nome: 'Rufo', pts: [[0, 0], [0, 4], [2, 4]], med: ['8', '2'] },
  { id: 'p-calha', nome: 'Calha', pts: [[2, 6], [0, 4], [0, 0], [14, 0], [14, 4], [21, 4], [20, 2]], med: ['4', '5', '20', '10', '10', '1'] },
  { id: 'p-platibanda', nome: 'Calha platibanda', pts: [[0, 0], [0, 6], [16, 7], [16, 5], [18, 5]], med: ['15', '30', '3', '2'] },
  { id: 'p-corta-onda', nome: 'Corta-onda', pts: [[2, 6], [0, 4], [0, 0], [12, 0], [24, 3], [24, 6]], med: ['2', '4', '19', '21', '5'] },
];

/** Quantos metros saem de cada bobina (para a folha de produção). */
export function porBobina(pecas: Peca[]): { bobina: number; metros: number }[] {
  const m = new Map<number, number>();
  for (const p of pecas) {
    const pr = pecaPronta(p);
    if (!pr.ok) continue;
    const b = bobinaDoCorte(pr.cobrado);
    m.set(b, r2((m.get(b) ?? 0) + pr.metros));
  }
  return [...m.entries()].sort((x, y) => x[0] - y[0]).map(([bobina, metros]) => ({ bobina, metros }));
}

/** O que vai junto na folha de produção: acessórios do orçamento e os metros por bobina. */
export function notasProducao(orc: Pick<Orcamento, 'itens' | 'pecas'>): string[] {
  const itens = orc.itens
    .filter((i) => i.tipo === 'unidade' && i.descricao.trim() && i.quantidade > 0)
    .map((i) => `${fmtBR(i.quantidade, 0, 2).padStart(2, '0')} – ${i.descricao.trim()}`);
  const bobs = porBobina(orc.pecas ?? []).map((b) => `Bobina ${b.bobina}:  ${fmtBR(b.metros, 2)} m`);
  return [...itens, ...(itens.length && bobs.length ? [''] : []), ...bobs];
}
