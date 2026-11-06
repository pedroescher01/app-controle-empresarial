import { describe, expect, it } from 'vitest';
import { cobrarParaReceber, taxaPct, valorTaxa } from './taxas';

describe('taxas da maquininha', () => {
  it('tabela da InfinitePay', () => {
    expect(taxaPct('Cartão de débito', { meio: 'maquininha', bandeira: 'visamaster', parcelas: 1 })).toBe(1.37);
    expect(taxaPct('Cartão de crédito', { meio: 'maquininha', bandeira: 'visamaster', parcelas: 1 })).toBe(3.15);
    expect(taxaPct('Cartão de crédito', { meio: 'maquininha', bandeira: 'visamaster', parcelas: 3 })).toBe(6.12);
    expect(taxaPct('Cartão de crédito', { meio: 'maquininha', bandeira: 'elo', parcelas: 12 })).toBe(13.41);
    expect(taxaPct('Cartão de débito', { meio: 'maquininha', bandeira: 'amexhiper', parcelas: 1 })).toBeNull();
    expect(taxaPct('Cartão de crédito', { meio: 'link', bandeira: 'visamaster', parcelas: 6 })).toBe(9.67);
    expect(taxaPct('Cartão de débito', { meio: 'link', bandeira: 'visamaster', parcelas: 1 })).toBeNull();
  });
  it('valor da taxa e quanto cobrar para receber limpo', () => {
    expect(valorTaxa(1000, 6.12)).toBe(61.2);
    const cobrar = cobrarParaReceber(1000, 6.12);
    expect(cobrar).toBe(1065.19);
    expect(cobrar - valorTaxa(cobrar, 6.12)).toBeGreaterThanOrEqual(1000);
  });
});
