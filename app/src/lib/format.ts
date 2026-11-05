// Formatação no padrão brasileiro: moeda, números, datas, telefone, CPF/CNPJ.

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');

/** "1.290,00" — sem o R$ (usado nas colunas do PDF). */
export const dec2 = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quantidade: até 2 casas, sem zeros sobrando ("2,3", "27", "0,5"). */
export const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Lê número digitado ("2,5", "1.250,75", "2.5"). */
export function parseDecimal(s: string): number {
  let t = (s || '').replace(/[^\d.,-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

export function maskPhone(s: string): string {
  const d = onlyDigits(s).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCPF(s: string): string {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function maskCNPJ(s: string): string {
  const d = onlyDigits(s).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// ---------- datas (sempre AAAA-MM-DD no horário local) ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeISO = () => toISO(new Date());
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDias(iso: string, dias: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + dias);
  return toISO(d);
}
export function fmtData(iso: string | null | undefined) {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDataCurta(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}
export function diasEntre(aISO: string, bISO: string) {
  return Math.round((fromISO(bISO.slice(0, 10)).getTime() - fromISO(aISO.slice(0, 10)).getTime()) / 86400000);
}
export function haDias(iso: string) {
  const n = diasEntre(iso, hojeISO());
  if (n <= 0) return 'hoje';
  if (n === 1) return 'ontem';
  return `há ${n} dias`;
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const nomeMes = (m: number) => MESES[m];
export function dataExtenso(d = new Date()) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// ---------- links ----------
export function waLink(phone: string, text?: string) {
  let d = onlyDigits(phone);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const telLink = (phone: string) => `tel:${onlyDigits(phone)}`;
export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
