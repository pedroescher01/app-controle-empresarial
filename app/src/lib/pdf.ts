// Gerador do orçamento: réplica do modelo oficial "nota fiscal quadriculada" (A5, margem 18pt, Arimo/Liberation Sans).
// As medidas abaixo foram tiradas do PDF de referência (Orçamento 364 - Edgar).
import { jsPDF } from 'jspdf';
import { dec2, qtd, fmtData } from './format';

export type PDFLinha = { quant: string; unid: string; desc: string; unit: string; total: string };

export type PDFDados = {
  numero: number;
  emitidoEm: string;
  validoAte: string | null;
  cliente: string;
  endereco: string;
  fone: string;
  linhas: PDFLinha[];
  subtotal: number;
  desconto: number;
  total: number;
  observacoes: string[];
  quitado: boolean;
  assinaturaCliente: string;
  email: string;
};

export type PDFAssets = { regular: string; bold: string; logo: Uint8Array };

const W = 419.528;
const H = 595.276;
const M = 18;
const R = W - M; // 401.5
const LW = 0.8;
const FS = 9.6;
const ASC = 0.85; // posição da linha de base (ajustada à referência)
const ROW = 15;
const INNER_LW = 0.5;
const INNER = 70; // cinza bem escuro nas linhas internas da grade
const RED: [number, number, number] = [206, 18, 16];
const GRAY = 239;

const base = (top: number, size = FS) => top + ASC * size;

export function gerarPDF(d: PDFDados, a: PDFAssets): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [W, H], compress: true });
  doc.addFileToVFS('LiberationSans-Regular.ttf', a.regular);
  doc.addFont('LiberationSans-Regular.ttf', 'Arimo', 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', a.bold);
  doc.addFont('LiberationSans-Bold.ttf', 'Arimo', 'bold');
  doc.setProperties({ title: `Orçamento ${d.numero}`, creator: 'Calhas Andrade' });
  doc.setLineWidth(LW);
  doc.setDrawColor(0);
  doc.setTextColor(0);

  const font = (style: 'normal' | 'bold' = 'normal', size = FS) => {
    doc.setFont('Arimo', style);
    doc.setFontSize(size);
  };
  // linhas alinhadas a uma grade de 1pt: evita que algumas saiam mais grossas na tela do celular
  const g = (v: number) => Math.round(v);
  const ln = (x1: number, y1: number, x2: number, y2: number) => doc.line(g(x1), g(y1), g(x2), g(y2));
  const bx = (x: number, y: number, w: number, h: number, st?: string) => doc.rect(g(x), g(y), g(x + w) - g(x), g(y + h) - g(y), st);
  const inner = (f: () => void) => {
    doc.setLineWidth(INNER_LW);
    doc.setDrawColor(INNER, INNER, INNER);
    f();
    doc.setLineWidth(LW);
    doc.setDrawColor(0);
  };
  const center = (t: string, x0: number, x1: number, top: number) => doc.text(t, (x0 + x1) / 2, base(top), { align: 'center' });
  const fit = (t: string, max: number) => {
    if (doc.getTextWidth(t) <= max) return t;
    let s = t;
    while (s.length > 1 && doc.getTextWidth(s + '…') > max) s = s.slice(0, -1);
    return s + '…';
  };

  // ---------- cabeçalho ----------
  bx(M, M, R - M, 100.3);
  const logoH = 75.3;
  const logoW = logoH * (619 / 584);
  doc.addImage(a.logo, 'PNG', 34.6 + (82.5 - logoW) / 2, 30.5, logoW, logoH);
  const cx = (117.1 + R) / 2;
  font('bold', 14.3);
  doc.text('Calhas Andrade', cx, base(38.4, 14.3), { align: 'center' });
  font();
  [
    'CPF/CNPJ: 16.693.515/0001-54',
    'Rua 13 de maio, 874 - Centro - Araras/SP',
    'Telefone(s): (19) 98959-0119 / (19) 99783-7079',
    `E-mail: ${d.email}`.trimEnd(),
  ].forEach((t, i) => doc.text(t, cx, base(57.9 + i * 10.65), { align: 'center' }));

  // ---------- nº / emitido / válido ----------
  bx(M, 126.2, R - M, 15.5);
  inner(() => {
    ln(145.8, 126.2, 145.8, 141.7);
    ln(273.7, 126.2, 273.7, 141.7);
  });
  center(`Orçamento nº: ${d.numero}`, M, 145.8, 129.8);
  center(`Emitido em: ${fmtData(d.emitidoEm)}`, 145.8, 273.7, 129.8);
  center(`Válido até: ${d.validoAte ? fmtData(d.validoAte) : '-'}`, 273.7, R, 129.8);

  // ---------- cliente ----------
  const cy = 149.6;
  bx(M, cy, R - M, 46.4);
  inner(() => {
    ln(M, cy + 15.5, R, cy + 15.5);
    ln(M, cy + 30.9, R, cy + 30.9);
  });
  [
    ['Cliente:', d.cliente],
    ['Endereço:', d.endereco || 'Não informado'],
    ['Fone:', d.fone || 'Não informado'],
  ].forEach(([k, v], i) => {
    const top = cy + 3.6 + i * 15.4;
    doc.text(k, 20.4, base(top));
    const x = 20.4 + doc.getTextWidth(k) + 5.3;
    doc.text(fit(v, R - x - 3), x, base(top));
  });

  // ---------- itens ----------
  const cols = [M, 57.7, 97.4, 295.9, 348.7, R];
  const tTop = 211.9;
  const nRows = Math.max(8, d.linhas.length);
  const tBottom = tTop + ROW * (nRows + 1);
  doc.setFillColor(GRAY, GRAY, GRAY);
  bx(M, tTop, R - M, ROW, 'FD');
  bx(M, tTop, R - M, tBottom - tTop);
  // linhas internas mais finas: na tela do celular nenhuma sai mais grossa que as outras
  doc.setLineWidth(INNER_LW);
  doc.setDrawColor(INNER, INNER, INNER);
  for (let i = 2; i <= nRows; i++) ln(M, tTop + ROW * i, R, tTop + ROW * i);
  cols.slice(1, -1).forEach((x) => ln(x, tTop + ROW, x, tBottom));
  doc.setLineWidth(LW);
  doc.setDrawColor(0);
  ln(M, tTop + ROW, R, tTop + ROW);
  cols.slice(1, -1).forEach((x) => ln(x, tTop, x, tTop + ROW));
  ['Quant.', 'Unid.', 'Descrição', 'Unitário', 'Total'].forEach((t, i) => center(t, cols[i], cols[i + 1], tTop + 3.2));
  d.linhas.forEach((l, r) => {
    const top = tTop + ROW * (r + 1) + 3.2;
    [l.quant, l.unid, l.desc, l.unit, l.total].forEach((t, i) => {
      if (t) center(fit(t, cols[i + 1] - cols[i] - 6), cols[i], cols[i + 1], top);
    });
  });

  // ---------- subtotal / desconto / total ----------
  const sTop = tBottom + 15.9;
  const cw = (R - M) / 3;
  doc.setFillColor(GRAY, GRAY, GRAY);
  bx(M, sTop, R - M, 15.5, 'FD');
  bx(M, sTop, R - M, 30.9);
  ln(M, sTop + 15.5, R, sTop + 15.5);
  inner(() => {
    ln(M + cw, sTop, M + cw, sTop + 30.9);
    ln(M + 2 * cw, sTop, M + 2 * cw, sTop + 30.9);
  });
  [
    ['Subtotal', d.subtotal],
    ['Desconto', d.desconto],
    ['Total', d.total],
  ].forEach(([k, v], i) => {
    center(k as string, M + i * cw, M + (i + 1) * cw, sTop + 3.6);
    center(`R$ ${dec2(v as number)}`, M + i * cw, M + (i + 1) * cw, sTop + 19);
  });

  // ---------- observações ----------
  const oTop = sTop + 30.9 + 8;
  const maxW = R - 22.8 - 6;
  // na linha de quitação: "orçamento quitado." nunca quebra no meio e sobra espaço para o selo P.G
  const selo = doc.getTextWidth('P.G') + 14;
  const linhas = d.observacoes.flatMap((t, i) => {
    const ultima = d.quitado && i === d.observacoes.length - 1;
    const txt = ultima ? t.replace('orçamento quitado.', 'orçamento\u00a0quitado.') : t;
    return (doc.splitTextToSize(txt, ultima ? maxW - selo : maxW) as string[]).map((l) => l.replace(/\u00a0/g, ' '));
  });
  const oH = Math.max(79.1, 15.4 + 3.5 + linhas.length * 12.05 + 6);
  bx(M, oTop, R - M, oH);
  ln(M, oTop + 15.4, R, oTop + 15.4);
  font('bold');
  center('OBSERVAÇÕES', M, R, oTop + 3.5);
  font();
  linhas.forEach((t, i) => {
    const top = oTop + 18.9 + i * 12.05;
    doc.text(t, 22.8, base(top));
    if (d.quitado && i === linhas.length - 1) {
      // selo "P.G" vermelho circulado, discreto, ao lado da linha de quitação
      const x = 22.8 + doc.getTextWidth(t) + 6.4;
      const w = doc.getTextWidth('P.G');
      doc.setTextColor(...RED);
      doc.setDrawColor(...RED);
      doc.text('P.G', x, base(top));
      doc.ellipse(x + w / 2, base(top) - 4.6, w / 2 + 2.85, 6.3, 'S');
      doc.setTextColor(0);
      doc.setDrawColor(0);
    }
  });

  // ---------- assinaturas ----------
  let sigY = Math.max(547.2, oTop + oH + 45);
  if (sigY > H - 30) {
    doc.addPage([W, H]);
    doc.setLineWidth(LW);
    sigY = 547.2;
  }
  ln(37.2, sigY, 190.6, sigY);
  ln(228.9, sigY, 382.4, sigY);
  center('Calhas Andrade', 37.2, 190.6, sigY + 7);
  // nome comprido: diminui a letra (até 7,5) antes de cortar
  for (let t = FS; t >= 7.5 && doc.getTextWidth(d.assinaturaCliente) > 150; t -= 0.3) doc.setFontSize(t);
  center(fit(d.assinaturaCliente, 150), 228.9, 382.4, sigY + 7);
  doc.setFontSize(FS);

  return doc;
}

// ---------- montagem a partir do orçamento ----------
import type { Orcamento, Calheiro, Config } from './db';
import { calcular, linhasObservacoes, nomeClientePDF } from './calc';

export function dadosDoOrcamento(orc: Orcamento, calheiros: Calheiro[], cfg: Config): PDFDados {
  const r = calcular(orc, cfg);
  const { linhas: obs, quitado } = linhasObservacoes(orc, r.total);
  const simples = orc.modo === 'simples';
  return {
    numero: orc.numero,
    emitidoEm: orc.emitidoEm,
    validoAte: orc.validoAte,
    cliente: nomeClientePDF(orc, calheiros),
    endereco: orc.endereco,
    fone: orc.telefone,
    linhas: r.linhas
      .filter((l) => l.item.descricao.trim() || l.item.quantidade)
      .map((l) => ({
        quant: qtd(l.item.quantidade),
        unid: l.item.unidade,
        desc: l.item.descricao,
        unit: simples ? '' : dec2(l.unit),
        total: simples ? '' : dec2(l.total),
      })),
    subtotal: r.subtotal,
    desconto: r.desconto,
    total: r.total,
    observacoes: obs,
    quitado,
    assinaturaCliente: orc.clienteNome,
    email: cfg.email,
  };
}

let cache: Promise<PDFAssets> | null = null;
function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function carregarAssets(): Promise<PDFAssets> {
  if (!cache) {
    const url = (f: string) => `${import.meta.env.BASE_URL}pdf/${f}`;
    cache = Promise.all(['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'logo.png'].map((f) => fetch(url(f)).then((r) => {
      if (!r.ok) throw new Error('Falha ao carregar ' + f);
      return r.arrayBuffer();
    }))).then(([reg, bold, logo]) => ({ regular: toB64(reg), bold: toB64(bold), logo: new Uint8Array(logo) }));
    cache.catch(() => (cache = null));
  }
  return cache;
}
