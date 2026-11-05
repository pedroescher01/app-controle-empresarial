// Relatórios do financeiro em PDF (A4, mesma fonte e logo do orçamento).
import { jsPDF } from 'jspdf';
import type { Lancamento } from './db';
import { dec2, fmtData } from './format';
import { doMes, nomeMesAno, resumo, somarMes } from './financeiro';
import type { PDFAssets } from './pdf';

const W = 595.28;
const H = 841.89;
const M = 36;
const R = W - M;
const RED: [number, number, number] = [200, 22, 29];

function novoDoc(a: PDFAssets, titulo: string, subtitulo: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('LiberationSans-Regular.ttf', a.regular);
  doc.addFont('LiberationSans-Regular.ttf', 'Arimo', 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', a.bold);
  doc.addFont('LiberationSans-Bold.ttf', 'Arimo', 'bold');
  doc.setProperties({ title: titulo, creator: 'Calhas Andrade' });
  doc.addImage(a.logo, 'PNG', M, M - 4, 52 * (619 / 584), 52);
  doc.setFont('Arimo', 'bold');
  doc.setFontSize(18);
  doc.text(titulo, M + 72, M + 18);
  doc.setFont('Arimo', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitulo, M + 72, M + 36);
  doc.setTextColor(0);
  doc.setDrawColor(200);
  doc.setLineWidth(0.6);
  doc.line(M, M + 62, R, M + 62);
  return doc;
}

function caixas(doc: jsPDF, y: number, itens: [string, number, boolean?][]) {
  const gap = 10;
  const w = (R - M - gap * (itens.length - 1)) / itens.length;
  itens.forEach(([k, v, destaque], i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(destaque ? 251 : 245, destaque ? 233 : 243, destaque ? 233 : 242);
    doc.roundedRect(x, y, w, 52, 6, 6, 'F');
    doc.setFont('Arimo', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(k, x + 10, y + 18);
    doc.setFont('Arimo', 'bold');
    doc.setFontSize(14);
    if (destaque) doc.setTextColor(...RED);
    else doc.setTextColor(0);
    doc.text(`R$ ${dec2(v)}`, x + 10, y + 40);
  });
  doc.setTextColor(0);
  return y + 52;
}

type Col = { t: string; w: number; dir?: boolean };

function tabela(doc: jsPDF, y: number, cols: Col[], linhas: string[][], opts: { total?: string[] } = {}) {
  const altura = 18;
  const cab = () => {
    doc.setFillColor(239, 239, 239);
    doc.rect(M, y, R - M, altura, 'F');
    doc.setFont('Arimo', 'bold');
    doc.setFontSize(9);
    let x = M;
    cols.forEach((c) => {
      doc.text(c.t, c.dir ? x + c.w - 6 : x + 6, y + 12.5, { align: c.dir ? 'right' : 'left' });
      x += c.w;
    });
    y += altura;
  };
  cab();
  const linha = (cells: string[], bold = false) => {
    if (y > H - M - altura) {
      doc.addPage();
      y = M;
      cab();
    }
    doc.setFont('Arimo', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    let x = M;
    cells.forEach((t, i) => {
      const c = cols[i];
      let s = t;
      while (s.length > 1 && doc.getTextWidth(s) > c.w - 12) s = s.slice(0, -2) + '…';
      doc.text(s, c.dir ? x + c.w - 6 : x + 6, y + 12.5, { align: c.dir ? 'right' : 'left' });
      x += c.w;
    });
    doc.setDrawColor(225);
    doc.setLineWidth(0.5);
    doc.line(M, y + altura, R, y + altura);
    y += altura;
  };
  linhas.forEach((l) => linha(l));
  if (opts.total) linha(opts.total, true);
  return y;
}

function titulo(doc: jsPDF, y: number, t: string) {
  if (y > H - M - 60) {
    doc.addPage();
    y = M;
  }
  doc.setFont('Arimo', 'bold');
  doc.setFontSize(12);
  doc.text(t, M, y + 12);
  return y + 22;
}

const hoje = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function relatorioMes(lancs: Lancamento[], mes: string, a: PDFAssets): File {
  const doMesLancs = doMes(lancs, mes).sort((x, y) => x.data.localeCompare(y.data));
  const r = resumo(doMesLancs);
  const doc = novoDoc(a, `Relatório de ${nomeMesAno(mes)}`, `Calhas Andrade · gerado em ${hoje()}`);
  let y = caixas(doc, M + 78, [['Entrou', r.entrou], ['Taxas da maquininha', r.taxas], ['Saiu', r.saiu], ['Sobrou', r.sobrou, true]]);

  if (r.porCategoria.length) {
    y = titulo(doc, y + 22, 'Gastos por categoria');
    y = tabela(doc, y, [{ t: 'Categoria', w: 343 }, { t: '%', w: 80, dir: true }, { t: 'Valor', w: R - M - 423, dir: true }],
      r.porCategoria.map((c) => [c.categoria, r.saiu ? `${Math.round((c.valor / r.saiu) * 100)}%` : '-', `R$ ${dec2(c.valor)}`]),
      { total: ['Total', '100%', `R$ ${dec2(r.saiu)}`] });
  }

  y = titulo(doc, y + 22, 'Lançamentos');
  if (!doMesLancs.length) {
    doc.setFont('Arimo', 'normal');
    doc.setFontSize(10);
    doc.text('Nenhum lançamento neste mês.', M, y + 10);
  } else {
    tabela(doc, y, [{ t: 'Data', w: 62 }, { t: 'Descrição', w: 200 }, { t: 'Categoria', w: 110 }, { t: 'Forma', w: 72 }, { t: 'Valor', w: R - M - 444, dir: true }],
      doMesLancs.map((l) => [fmtData(l.data), l.descricao, l.categoria, l.forma, `${l.tipo === 'entrada' ? '+' : '−'} R$ ${dec2(l.valor)}`]));
  }
  return new File([doc.output('blob')], `Relatório ${nomeMesAno(mes)} - Calhas Andrade.pdf`, { type: 'application/pdf' });
}

export function relatorioAno(lancs: Lancamento[], ano: number, a: PDFAssets): File {
  const meses = Array.from({ length: 12 }, (_, i) => somarMes(`${ano}-01`, i));
  const doAno = lancs.filter((l) => l.data.startsWith(String(ano)));
  const r = resumo(doAno);
  const doc = novoDoc(a, `Relatório de ${ano}`, `Calhas Andrade · gerado em ${hoje()}`);
  let y = caixas(doc, M + 78, [['Entrou', r.entrou], ['Taxas da maquininha', r.taxas], ['Saiu', r.saiu], ['Sobrou', r.sobrou, true]]);
  y = titulo(doc, y + 22, 'Mês a mês');
  y = tabela(doc, y, [{ t: 'Mês', w: 163 }, { t: 'Entrou', w: 90, dir: true }, { t: 'Taxas', w: 80, dir: true }, { t: 'Saiu', w: 90, dir: true }, { t: 'Sobrou', w: R - M - 423, dir: true }],
    meses.map((m) => {
      const x = resumo(doMes(doAno, m));
      return [nomeMesAno(m), `R$ ${dec2(x.entrou)}`, `R$ ${dec2(x.taxas)}`, `R$ ${dec2(x.saiu)}`, `R$ ${dec2(x.sobrou)}`];
    }),
    { total: ['Total do ano', `R$ ${dec2(r.entrou)}`, `R$ ${dec2(r.taxas)}`, `R$ ${dec2(r.saiu)}`, `R$ ${dec2(r.sobrou)}`] });
  if (r.porCategoria.length) {
    y = titulo(doc, y + 22, 'Gastos por categoria no ano');
    tabela(doc, y, [{ t: 'Categoria', w: 343 }, { t: '%', w: 80, dir: true }, { t: 'Valor', w: R - M - 423, dir: true }],
      r.porCategoria.map((c) => [c.categoria, r.saiu ? `${Math.round((c.valor / r.saiu) * 100)}%` : '-', `R$ ${dec2(c.valor)}`]),
      { total: ['Total', '100%', `R$ ${dec2(r.saiu)}`] });
  }
  return new File([doc.output('blob')], `Relatório ${ano} - Calhas Andrade.pdf`, { type: 'application/pdf' });
}
