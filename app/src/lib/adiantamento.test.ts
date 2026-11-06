import { describe, expect, it } from 'vitest';
import { chaveItem, saldos, sugestoes } from './adiantamento';
import type { Adiantamento, Item } from './db';

const mov = (p: Partial<Adiantamento>): Adiantamento => ({ id: Math.random().toString(), calheiroId: 'ze', chave: 'silicone', descricao: 'Silicone', quantidade: 4, data: '2026-11-06', orcamentoId: null, criadoEm: '', ...p });
const it_ = (p: Partial<Item>): Item => ({ id: 'i', tipo: 'unidade', descricao: 'Silicone', catalogo: 'silicone', unidade: 'un', quantidade: 4, precoUnit: 35, ...p });

describe('material adiantado', () => {
  it('saldo soma retiradas e descontos', () => {
    expect(saldos([mov({}), mov({ quantidade: -2, orcamentoId: 'o1' })], 'ze')).toEqual([{ chave: 'silicone', descricao: 'Silicone', saldo: 2 }]);
    expect(saldos([mov({}), mov({ quantidade: -4, orcamentoId: 'o1' })], 'ze')).toEqual([]);
  });
  it('sugere descontar até o que tem e até o que o orçamento usa', () => {
    expect(sugestoes([mov({})], ['ze'], [it_({ quantidade: 2 })], 'o1')[0]).toMatchObject({ saldo: 4, noOrcamento: 2, sugerido: 2 });
    expect(sugestoes([mov({ quantidade: 3 })], ['ze'], [it_({ quantidade: 5 })], 'o1')[0]).toMatchObject({ sugerido: 3 });
  });
  it('depois de descontar, mostra o que já foi descontado', () => {
    const s = sugestoes([mov({}), mov({ quantidade: -2, orcamentoId: 'o1' })], ['ze'], [it_({ quantidade: 2 })], 'o1')[0];
    expect(s).toMatchObject({ saldo: 2, jaDescontado: 2, sugerido: 0 });
  });
  it('item digitado casa pela descrição, sem acento', () => {
    expect(chaveItem({ descricao: 'Bucha 8 ', catalogo: undefined })).toBe('desc:bucha 8');
    expect(chaveItem({ descricao: 'Bucha 8', catalogo: 'bucha8' })).toBe('bucha8');
  });
  it('não sugere nada para quem não tem material', () => {
    expect(sugestoes([mov({})], ['outro'], [it_({})], 'o1')).toEqual([]);
  });
});
