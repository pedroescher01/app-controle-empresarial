import type { ContaFixa, Lancamento } from './db';
import { addDias, fromISO, hojeISO, r2, toISO } from './format';

export const CATEGORIAS_SAIDA = [
  'Fornecedor',
  'Calheiro',
  'Combustível',
  'Aluguel',
  'Impostos',
  'Contas (luz, água, internet)',
  'Ferramentas',
  'Alimentação',
  'Manutenção',
  'Retirada do Pedro',
  'Outros',
];
export const CATEGORIAS_ENTRADA = ['Orçamento', 'Venda no balcão', 'Outros'];
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "2026-11" */
export const mesDe = (iso: string) => iso.slice(0, 7);
export function somarMes(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const ultimoDia = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** Valor que entrou de verdade (desconta a taxa da maquininha). */
export const liquido = (l: Lancamento) => r2(l.valor - (l.taxa ?? 0));

export type Resumo = { entrou: number; taxas: number; saiu: number; sobrou: number; porCategoria: { categoria: string; valor: number }[] };

export function resumo(lancs: Lancamento[]): Resumo {
  const ent = lancs.filter((l) => l.tipo === 'entrada');
  const sai = lancs.filter((l) => l.tipo === 'saida');
  const entrou = r2(ent.reduce((s, l) => s + l.valor, 0));
  const taxas = r2(ent.reduce((s, l) => s + (l.taxa ?? 0), 0));
  const saiu = r2(sai.reduce((s, l) => s + l.valor, 0));
  const cat = new Map<string, number>();
  sai.forEach((l) => cat.set(l.categoria, r2((cat.get(l.categoria) ?? 0) + l.valor)));
  return {
    entrou,
    taxas,
    saiu,
    sobrou: r2(entrou - taxas - saiu),
    porCategoria: [...cat.entries()].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
  };
}

export const doMes = (lancs: Lancamento[], mes: string) => lancs.filter((l) => l.data.startsWith(mes));

// ---------- contas a pagar ----------

/** Datas de vencimento de uma conta dentro de um mês. */
export function vencimentosNoMes(c: ContaFixa, mes: string): string[] {
  if (c.repete === 'unica') return c.vencimento && c.vencimento.startsWith(mes) ? [c.vencimento] : [];
  if (c.repete === 'mensal') return [`${mes}-${String(Math.min(c.dia, ultimoDia(mes))).padStart(2, '0')}`];
  const out: string[] = [];
  for (let d = 1; d <= ultimoDia(mes); d++) {
    const iso = `${mes}-${String(d).padStart(2, '0')}`;
    if (fromISO(iso).getDay() === c.dia) out.push(iso);
  }
  return out;
}

export type Vencimento = { conta: ContaFixa; data: string; paga: Lancamento | null; atrasada: boolean };

/**
 * Vencimentos do mês (pagos e a pagar). No mês atual também traz o que ficou sem pagar do mês anterior.
 * Só conta a partir do mês em que a conta foi cadastrada.
 */
export function vencimentos(contas: ContaFixa[], lancs: Lancamento[], mes: string, hoje = hojeISO()): Vencimento[] {
  const meses = mes === mesDe(hoje) ? [somarMes(mes, -1), mes] : [mes];
  const out: Vencimento[] = [];
  for (const c of contas) {
    if (!c.ativa && c.repete !== 'unica') continue;
    const desde = c.criadoEm.slice(0, 10);
    for (const m of meses) {
      for (const data of vencimentosNoMes(c, m)) {
        if (c.repete !== 'unica' && data < desde) continue;
        const paga = lancs.find((l) => l.contaFixaId === c.id && l.referencia === data) ?? null;
        if (m !== mes && paga) continue; // do mês anterior só interessa o que está em aberto
        out.push({ conta: c, data, paga, atrasada: !paga && data < hoje });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/** Contas em aberto que vencem até daqui a N dias (inclui as atrasadas). */
export function contasProximas(contas: ContaFixa[], lancs: Lancamento[], dias = 3, hoje = hojeISO()) {
  const limite = addDias(hoje, dias);
  const mes = mesDe(hoje);
  const lista = [...vencimentos(contas, lancs, mes, hoje), ...(mesDe(limite) !== mes ? vencimentos(contas, lancs, mesDe(limite), hoje) : [])];
  return lista.filter((v) => !v.paga && v.data <= limite);
}

export const nomeMesAno = (mes: string) => {
  const d = fromISO(mes + '-01');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
};

export const hojeMes = () => mesDe(toISO(new Date()));
