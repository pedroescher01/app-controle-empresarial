import { describe, expect, it } from 'vitest';
import { contasProximas, resumo, somarMes, vencimentos, vencimentosNoMes } from './financeiro';
import type { ContaFixa, Lancamento } from './db';

const conta = (p: Partial<ContaFixa>): ContaFixa => ({ id: 'c', descricao: 'Aluguel', categoria: 'Aluguel', valor: 2200, repete: 'mensal', dia: 10, vencimento: null, ativa: true, criadoEm: '2026-10-01T00:00:00Z', ...p });
const lanc = (p: Partial<Lancamento>): Lancamento => ({ id: Math.random().toString(), tipo: 'saida', data: '2026-11-05', valor: 100, descricao: '', categoria: 'Outros', forma: 'Pix', conta: 'Sicoob', criadoEm: '', ...p });

describe('vencimentos', () => {
  it('mensal respeita o último dia do mês', () => {
    expect(vencimentosNoMes(conta({ dia: 31 }), '2026-02')).toEqual(['2026-02-28']);
  });
  it('retirada toda sexta', () => {
    expect(vencimentosNoMes(conta({ repete: 'semanal', dia: 5 }), '2026-11')).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
  });
  it('paga some da lista de próximas; atrasada do mês anterior aparece', () => {
    const c = conta({});
    const pago = lanc({ contaFixaId: 'c', referencia: '2026-11-10' });
    expect(vencimentos([c], [pago], '2026-11', '2026-11-05').map((v) => [v.data, !!v.paga, v.atrasada])).toEqual([
      ['2026-10-10', false, true],
      ['2026-11-10', true, false],
    ]);
    expect(contasProximas([c], [], 7, '2026-11-05').map((v) => v.data)).toEqual(['2026-10-10', '2026-11-10']);
  });
  it('não cobra antes de cadastrar', () => {
    expect(vencimentos([conta({ criadoEm: '2026-11-03T12:00:00Z' })], [], '2026-11', '2026-11-05').map((v) => v.data)).toEqual(['2026-11-10']);
  });
  it('virada de ano', () => {
    expect(somarMes('2026-12', 1)).toBe('2027-01');
    expect(somarMes('2026-01', -1)).toBe('2025-12');
  });
});

describe('resumo', () => {
  it('sobrou = entrou − taxas − saiu', () => {
    const r = resumo([
      lanc({ tipo: 'entrada', valor: 1000, taxa: 30 }),
      lanc({ tipo: 'entrada', valor: 500 }),
      lanc({ valor: 200, categoria: 'Combustível' }),
      lanc({ valor: 300, categoria: 'Aluguel' }),
      lanc({ valor: 50, categoria: 'Combustível' }),
    ]);
    expect(r).toMatchObject({ entrou: 1500, taxas: 30, saiu: 550, sobrou: 920 });
    expect(r.porCategoria[0]).toEqual({ categoria: 'Aluguel', valor: 300 });
  });
});
