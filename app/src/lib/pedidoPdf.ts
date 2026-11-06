// PDF do pedido de compra (A5, mesmo cabeçalho e fonte do orçamento), para guardar.
import { jsPDF } from 'jspdf';
import type { Fornecedor, Pedido } from './db';
import { ESPESSURA, ordenarItens } from './bobinas';
import { dec2, fmtData, hojeISO } from './format';
import type { PDFAssets } from './pdf';

const W = 419.528;
const H = 595.276;
const M = 18;
const R = W - M;
const FS = 9.6;
const base = (top: number, size = FS) => top + 0.85 * size;

export function gerarPedidoPDF(p: Pedido, f: Fornecedor | null | undefined, a: PDFAssets, email: string): File {
  const doc = new jsPDF({ unit: 'pt', format: [W, H], compress: true });
  doc.addFileToVFS('LiberationSans-Regular.ttf', a.regular);
  doc.addFont('LiberationSans-Regular.ttf', 'Arimo', 'normal');
  doc.addFileToVFS('LiberationSans-Bold.ttf', a.bold);
  doc.addFont('LiberationSans-Bold.ttf', 'Arimo', 'bold');
  doc.setProperties({ title: `Pedido de compra ${p.numero}`, creator: 'Calhas Andrade' });
  const borda = () => { doc.setLineWidth(0.8); doc.setDrawColor(0); };
  const fino = () => { doc.setLineWidth(0.5); doc.setDrawColor(70); };
  const font = (st: 'normal' | 'bold' = 'normal', size = FS) => { doc.setFont('Arimo', st); doc.setFontSize(size); };
  const center = (t: string, x0: number, x1: number, top: number) => doc.text(t, (x0 + x1) / 2, base(top), { align: 'center' });

  // cabeçalho (igual ao orçamento)
  borda();
  doc.rect(M, M, R - M, 100);
  const lh = 75.3, lw = lh * (619 / 584);
  doc.addImage(a.logo, 'PNG', 34.6 + (82.5 - lw) / 2, 30.5, lw, lh);
  const cx = (117.1 + R) / 2;
  font('bold', 14.3);
  doc.text('Calhas Andrade', cx, base(38.4, 14.3), { align: 'center' });
  font();
  ['CPF/CNPJ: 16.693.515/0001-54', 'Rua 13 de maio, 874 - Centro - Araras/SP', 'Telefone(s): (19) 98959-0119 / (19) 99783-7079', `E-mail: ${email}`]
    .forEach((t, i) => doc.text(t, cx, base(57.9 + i * 10.65), { align: 'center' }));

  // título
  borda();
  doc.rect(M, 126, R - M, 16);
  fino();
  doc.line(209, 126, 209, 142);
  font('bold');
  center(`PEDIDO DE COMPRA nº ${p.numero}`, M, 209, 129.6);
  font();
  center(`Data: ${fmtData(p.pedidoEm ?? hojeISO())}`, 209, R, 129.6);

  // fornecedor
  borda();
  doc.rect(M, 150, R - M, 47);
  fino();
  doc.line(M, 165.5, R, 165.5);
  doc.line(M, 181, R, 181);
  [['Fornecedor:', f?.nome ?? 'Não informado'], ['CNPJ:', f?.cnpj || 'Não informado'], ['Vendedor:', [f?.vendedor, f?.telefone].filter(Boolean).join(' - ') || 'Não informado']].forEach(([k, v], i) => {
    const top = 153.6 + i * 15.5;
    doc.text(k, 20.4, base(top));
    doc.text(v, 20.4 + doc.getTextWidth(k) + 5.3, base(top));
  });

  // itens
  const cols = [M, 70, 220, 310, R];
  const tTop = 212;
  const ROW = 15;
  const itens = ordenarItens(p.itens);
  const n = Math.max(10, itens.length);
  const tBottom = tTop + ROW * (n + 1);
  doc.setFillColor(239, 239, 239);
  borda();
  doc.rect(M, tTop, R - M, ROW, 'FD');
  doc.rect(M, tTop, R - M, tBottom - tTop);
  fino();
  for (let i = 2; i <= n; i++) doc.line(M, tTop + ROW * i, R, tTop + ROW * i);
  cols.slice(1, -1).forEach((x) => doc.line(x, tTop + ROW, x, tBottom));
  borda();
  doc.line(M, tTop + ROW, R, tTop + ROW);
  cols.slice(1, -1).forEach((x) => doc.line(x, tTop, x, tTop + ROW));
  ['Quant.', 'Bobina galvanizada', 'Chapa', 'Espessura'].forEach((t, i) => center(t, cols[i], cols[i + 1], tTop + 3.2));
  itens.forEach((it, r) => {
    const top = tTop + ROW * (r + 1) + 3.2;
    [String(it.quantidade), `Corte ${it.corte} cm`, String(it.chapa), ESPESSURA[it.chapa]].forEach((t, i) => center(t, cols[i], cols[i + 1], top));
  });

  // observações / valores da nota
  const obs: string[] = [];
  if (p.observacoes.trim()) obs.push(...p.observacoes.trim().split('\n'));
  if (p.valorTotal) obs.push(`Valor da nota: R$ ${dec2(p.valorTotal)}${p.pesoKg ? ` - ${dec2(p.pesoKg)} kg` : ''}`);
  if (p.precoKg26) obs.push(`Preço do kg (chapa 26): R$ ${dec2(p.precoKg26)}`);
  if (p.precoKg24) obs.push(`Preço do kg (chapa 24): R$ ${dec2(p.precoKg24)}`);
  if (p.pagoEm) obs.push(`Pago em ${fmtData(p.pagoEm)} (${p.formaPagamento}).`);
  const oTop = tBottom + 12;
  const linhas = obs.flatMap((t) => doc.splitTextToSize(t, R - 22.8 - 6) as string[]);
  const oH = Math.max(70, 15.4 + 3.5 + linhas.length * 12.05 + 6);
  borda();
  doc.rect(M, oTop, R - M, oH);
  doc.line(M, oTop + 15.4, R, oTop + 15.4);
  font('bold');
  center('OBSERVAÇÕES', M, R, oTop + 3.5);
  font();
  linhas.forEach((t, i) => doc.text(t, 22.8, base(oTop + 18.9 + i * 12.05)));

  const sigY = Math.max(547, oTop + oH + 40);
  borda();
  doc.line(37.2, sigY, 190.6, sigY);
  doc.line(228.9, sigY, 382.4, sigY);
  center('Calhas Andrade', 37.2, 190.6, sigY + 7);
  center(f?.nome ?? 'Fornecedor', 228.9, 382.4, sigY + 7);

  return new File([doc.output('blob')], `Pedido ${p.numero} - ${f?.nome ?? 'Fornecedor'}.pdf`, { type: 'application/pdf' });
}
