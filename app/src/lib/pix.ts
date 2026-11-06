// Pix "copia e cola" / QR Code com valor (BR Code estático, padrão do Banco Central).
// Não usa o banco: o código é montado com a chave Pix. O dinheiro cai direto na conta da chave.
import qrcode from 'qrcode-generator';
import { onlyDigits } from './format';

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

/** Sem acento e só caracteres aceitos pelo padrão. */
const limpar = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 $%*+\-./:]/g, '').trim().slice(0, max);

export function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Chave no formato que o Pix espera (CPF/CNPJ só números, telefone com +55, e-mail e aleatória como vieram). */
export function normalizarChave(chave: string) {
  const c = chave.trim();
  if (/@/.test(c)) return c.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
  const d = onlyDigits(c);
  if (/^\+/.test(c)) return '+' + d;
  if (d.length === 11 && /[.-]/.test(c) && !/\(/.test(c)) return d; // CPF formatado
  if (d.length === 14) return d; // CNPJ
  if (d.length === 11 && /\(/.test(c)) return '+55' + d; // celular "(19) 9…"
  return d.length === 11 ? d : c;
}

export type PixDados = { chave: string; nome: string; cidade: string; valor: number; txid?: string; descricao?: string };

export function pixCopiaECola({ chave, nome, cidade, valor, txid, descricao }: PixDados) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChave(chave)) + (descricao ? campo('02', limpar(descricao, 40)) : '');
  const id = limpar(txid || '***', 25).replace(/[^A-Za-z0-9*]/g, '') || '***';
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor > 0 ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(nome, 25).toUpperCase()) +
    campo('60', limpar(cidade, 15).toUpperCase()) +
    campo('62', campo('05', id)) +
    '6304';
  return corpo + crc16(corpo);
}

/** Matriz do QR Code (true = quadradinho preto). */
export function qrMatriz(texto: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** SVG do QR Code (para mostrar na tela). */
export function qrSvg(texto: string, cor = '#000') {
  const m = qrMatriz(texto);
  const n = m.length;
  let d = '';
  m.forEach((linha, r) => linha.forEach((on, c) => { if (on) d += `M${c + 4} ${r + 4}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="${cor}"/></svg>`;
}
