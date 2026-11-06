// Taxas da InfinitePay (maquininha/InfiniteTap e link de pagamento), em %.
// Fonte: tabela enviada pelo Pedro em 06/11/2026. Ficam na configuração (dá para atualizar sem mexer no app).
import { r2 } from './format';

export type Meio = 'maquininha' | 'link';
export type Bandeira = 'visamaster' | 'elo' | 'amexhiper';
export type TabelaTaxas = {
  maquininha: Record<Bandeira, { debito: number | null; credito: number[] }>;
  link: { credito: number[] };
};

const ELO = [4.91, 6.47, 7.2, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41];
export const TAXAS_PADRAO: TabelaTaxas = {
  maquininha: {
    visamaster: { debito: 1.37, credito: [3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.4] },
    elo: { debito: 2.58, credito: ELO },
    amexhiper: { debito: null, credito: ELO },
  },
  link: { credito: [4.2, 6.09, 7.01, 7.91, 8.8, 9.67, 12.59, 13.42, 14.25, 15.06, 15.87, 16.66] },
};

export const BANDEIRAS: { k: Bandeira; l: string }[] = [
  { k: 'visamaster', l: 'Visa / Master' },
  { k: 'elo', l: 'Elo' },
  { k: 'amexhiper', l: 'Amex / Hiper' },
];

export type Cartao = { meio: Meio; bandeira: Bandeira; parcelas: number };

/** Taxa em % para a forma (Cartão de crédito/débito) e os dados do cartão. null = não existe essa opção. */
export function taxaPct(forma: string, c: Cartao, t: TabelaTaxas = TAXAS_PADRAO): number | null {
  const debito = forma === 'Cartão de débito';
  if (c.meio === 'link') return debito ? null : t.link.credito[Math.min(12, Math.max(1, c.parcelas)) - 1] ?? null;
  const b = t.maquininha[c.bandeira];
  if (debito) return b.debito;
  return b.credito[Math.min(12, Math.max(1, c.parcelas)) - 1] ?? null;
}

/** Valor da taxa em R$. */
export const valorTaxa = (valor: number, pct: number) => r2((valor * pct) / 100);

/** Quanto cobrar para cair o valor cheio (repassando a taxa ao cliente). */
export const cobrarParaReceber = (receber: number, pct: number) => Math.ceil((receber / (1 - pct / 100)) * 100) / 100;

export const descricaoCartao = (forma: string, c: Cartao) =>
  forma === 'Cartão de débito'
    ? `débito ${BANDEIRAS.find((b) => b.k === c.bandeira)?.l}`
    : `${c.parcelas}x ${c.meio === 'link' ? 'no link' : BANDEIRAS.find((b) => b.k === c.bandeira)?.l}`;
