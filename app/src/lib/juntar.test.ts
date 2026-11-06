import { describe, expect, it } from 'vitest';
import { juntar, podeJuntar } from './juntar';
import { calcular } from './calc';
import type { Item, Orcamento } from './db';

const cfg = { precoMetro: 60, fatorChapa24: 1.5 };
const it_ = (p: Partial<Item>): Item => ({ id: Math.random().toString(), tipo: 'unidade', descricao: 'x', unidade: 'un', quantidade: 1, precoUnit: 0, ...p });
const orc = (p: Partial<Orcamento>): Orcamento => ({
  id: Math.random().toString(), numero: 1, clienteId: 'c', clienteNome: 'Edgar', telefone: '', endereco: '', calheiroIds: [], modo: 'simples', itens: [], desconto: 0,
  totalDesejado: null, valorAVista: null, observacoes: '', status: 'enviado', emitidoEm: '2026-10-01', validoAte: null, enviadoEm: null, aprovadoEm: null,
  parcelas: 1, pagamentos: [], criadoEm: '', atualizadoEm: '', ...p,
});

describe('juntar orçamentos', () => {
  const a = orc({ numero: 4821, emitidoEm: '2026-10-05', calheiroIds: ['dalvo'], itens: [
    it_({ tipo: 'metro', descricao: 'Calha', unidade: 'm', corte: 33, quantidade: 20 }),
    it_({ descricao: 'Silicone', precoUnit: 35, quantidade: 2 }),
    it_({ tipo: 'mao', descricao: 'Mão de obra', precoUnit: 400 }),
  ] });
  const b = orc({ numero: 5310, emitidoEm: '2026-10-20', calheiroIds: ['dalvo', 'miguel'], desconto: 50, totalDesejado: 1000, itens: [
    it_({ tipo: 'metro', descricao: 'Rufo', unidade: 'm', corte: 25, quantidade: 13.5 }),
    it_({ descricao: 'Silicone', precoUnit: 35, quantidade: 1 }),
    it_({ descricao: 'Bocal 4"', precoUnit: 10, quantidade: 3 }),
    it_({ tipo: 'mao', descricao: 'Mão de obra', precoUnit: 300 }),
  ] });
  const j = juntar([b, a], cfg);

  it('uma linha só de metragem, somada', () => {
    const m = j.itens.filter((i) => i.tipo === 'metro');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ descricao: 'Calhas e rufos', quantidade: 33.5, unidade: 'm' });
  });
  it('soma itens iguais e mão de obra', () => {
    expect(j.itens.find((i) => i.descricao === 'Silicone')?.quantidade).toBe(3);
    expect(j.itens.filter((i) => i.tipo === 'mao')).toEqual([expect.objectContaining({ precoUnit: 700 })]);
  });
  it('total bate até o centavo com a soma dos dois', () => {
    const soma = calcular(a, cfg).total + calcular(b, cfg).total;
    const novo = calcular({ itens: j.itens, desconto: j.desconto, totalDesejado: null }, cfg);
    expect(novo.total).toBeCloseTo(soma, 2);
    expect(Math.round(novo.total * 100)).toBe(Math.round(soma * 100));
    expect(j.total).toBe(Math.round(soma * 100) / 100);
  });
  it('observação lista os orçamentos em ordem de data', () => {
    expect(j.observacao).toBe('Este orçamento reúne 2 orçamentos: nº 4821 (05/10/2026) e nº 5310 (20/10/2026).');
    expect(j.calheiroIds).toEqual(['dalvo', 'miguel']);
  });
  it('não junta orçamento pago, recusado ou já juntado', () => {
    expect(podeJuntar(orc({ pagamentos: [{ id: 'p', data: '', valor: 1, forma: 'Pix', conta: '' }] }))).toBe(false);
    expect(podeJuntar(orc({ status: 'recusado' }))).toBe(false);
    expect(podeJuntar(orc({ juntadoNo: 'x' }))).toBe(false);
    expect(podeJuntar(orc({}))).toBe(true);
  });
});
