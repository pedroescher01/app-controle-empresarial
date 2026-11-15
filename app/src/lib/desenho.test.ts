import { describe, expect, it } from 'vitest';
import type { Item, Peca } from './db';
import { calcular } from './calc';
import { batidas, bobinaDoCorte, corteCobrado, corteReal, fmtGrupos, gruposMetr, notasProducao, numero, pecaPronta, porBobina, sincronizarItens, somaMetr, valorDaJogada } from './desenho';

const cfg = { precoMetro: 60, fatorChapa24: 1.5 };
const peca = (id: string, med: string[], metr: string, nome = ''): Peca => ({
  id, nome, pts: med.map((_, i) => [i, 0] as [number, number]).concat([[med.length, 0]]), med, metr, ox: 0, oy: 0, placed: true,
});
// folha do Zé Carlos (22/dez): calha cônica C/50 de 5,30 m e rufo C/10 de 3,30 m
const calha = peca('calha', ['1', '20', '12', '13/10', '4'], '5,30', 'Calha');
const rufo = peca('rufo', ['8', '2'], '3,30', 'Rufo');

describe('corte', () => {
  it('cobra do corte de cima', () => {
    expect(corteCobrado(38)).toBe(40);
    expect(corteCobrado(31)).toBe(33);
    expect(corteCobrado(50)).toBe(50);
    expect(corteCobrado(8)).toBe(10);
  });
  it('acima de 65 vai de 5 em 5 e sai da bobina de 120', () => {
    expect(corteCobrado(66)).toBe(70);
    expect(corteCobrado(118)).toBe(120);
    expect(bobinaDoCorte(70)).toBe(120);
    expect(bobinaDoCorte(35)).toBe(35);
  });
  it('cônica tem um corte para cada ponta', () => {
    const c = corteReal(calha);
    expect([c.a, c.b, c.conica, c.completo]).toEqual([50, 47, true, true]);
  });
  it('aba sem medida deixa o corte incompleto', () => {
    expect(corteReal({ med: ['4', null] }).completo).toBe(false);
  });
});

describe('números e metragem', () => {
  it('lê os jeitos de escrever número', () => {
    expect(numero('17,5')).toBe(17.5);
    expect(numero('5.30')).toBe(5.3);
    expect(numero('1.160')).toBe(1160);
    expect(numero('1.300,00')).toBe(1300);
  });
  it('soma metragens', () => {
    expect(somaMetr('9+2')).toBe(11);
    expect(somaMetr('4x2,5+1')).toBe(11);
    expect(fmtGrupos(gruposMetr('4x2,5+1'))).toBe('4 × 2,50 + 1,00');
    expect(somaMetr('4 × 2,50 + 1,00')).toBe(11);
    expect(gruposMetr('abc')).toEqual([]);
  });
});

describe('batidas', () => {
  it('soma acumulada das abas', () => {
    expect(batidas({ med: ['2', '4', '20', '4', '2'] })).toEqual(['2 · 6 · 26 · 30 · 32']);
  });
  it('cônica: uma linha para cada ponta; inverte', () => {
    expect(batidas(calha)).toEqual(['C/50:  1 · 21 · 33 · 46 · 50', 'C/47:  1 · 21 · 33 · 43 · 47']);
    expect(batidas({ med: ['2', '4', '20'], flip: true })).toEqual(['20 · 24 · 26']);
  });
});

describe('peça vira item do orçamento', () => {
  it('cria um item por metro para cada peça pronta', () => {
    const itens = sincronizarItens([], [calha, rufo]);
    expect(itens.map((i) => [i.descricao, i.quantidade, i.corte, i.tipo, i.pecaId])).toEqual([
      ['Calha', 5.3, 50, 'metro', 'calha'],
      ['Rufo', 3.3, 10, 'metro', 'rufo'],
    ]);
  });
  it('bate com a folha do Zé Carlos: R$ 310 com a jogada', () => {
    const extras: Item[] = [
      { id: 's', tipo: 'unidade', descricao: 'Silicone', unidade: 'un', quantidade: 2, precoUnit: 35 },
      { id: 'b', tipo: 'unidade', descricao: 'Brocante', unidade: 'un', quantidade: 100, precoUnit: 0.3 },
      { id: 'o', tipo: 'unidade', descricao: 'Bocal 4"', unidade: 'un', quantidade: 1, precoUnit: 10 },
    ];
    const itens = sincronizarItens(extras, [calha, rufo]);
    const base = calcular({ itens, desconto: 0, totalDesejado: null }, cfg);
    expect(base.subtotalBase).toBe(288.8);
    const alvo = valorDaJogada(base.subtotalBase);
    expect(alvo).toBe(310);
    expect(calcular({ itens, desconto: 0, totalDesejado: alvo }, cfg).total).toBe(310);
  });
  it('não toca nos itens digitados à mão e mantém a ordem', () => {
    const mao: Item = { id: 'm', tipo: 'mao', descricao: 'Mão de obra', unidade: 'un', quantidade: 1, precoUnit: 750 };
    const itens = sincronizarItens([mao], [calha]);
    expect(itens[0]).toBe(mao);
    expect(itens).toHaveLength(2);
  });
  it('atualiza o item quando o desenho muda, mantendo a chapa escolhida', () => {
    const antes = sincronizarItens([], [calha]).map((i) => ({ ...i, chapa: 24 as const }));
    const depois = sincronizarItens(antes, [{ ...calha, metr: '6+2' }]);
    expect(depois).toHaveLength(1);
    expect([depois[0].id, depois[0].quantidade, depois[0].chapa]).toEqual([antes[0].id, 8, 24]);
  });
  it('peça apagada ou incompleta tira o item', () => {
    const antes = sincronizarItens([], [calha, rufo]);
    expect(sincronizarItens(antes, [rufo]).map((i) => i.pecaId)).toEqual(['rufo']);
    expect(sincronizarItens(antes, [calha, { ...rufo, metr: '' }]).map((i) => i.pecaId)).toEqual(['calha']);
  });
  it('peça sem nome vira "Calhas e rufos" e aceita nome trocado no orçamento', () => {
    const semNome = peca('x', ['30'], '2');
    const itens = sincronizarItens([], [semNome]);
    expect(itens[0].descricao).toBe('Calhas e rufos');
    const renomeado = sincronizarItens([{ ...itens[0], descricao: 'Rufo do muro' }], [semNome]);
    expect(renomeado[0].descricao).toBe('Rufo do muro');
  });
  it('corte que passa de 120 não vira item', () => {
    expect(pecaPronta(peca('g', ['125'], '2')).ok).toBe(false);
    expect(sincronizarItens([], [peca('g', ['125'], '2')])).toEqual([]);
  });
});

describe('jogada', () => {
  it('soma 5% e arredonda para cima', () => {
    expect(valorDaJogada(193)).toBe(210);
    expect(valorDaJogada(200)).toBe(210);
    expect(valorDaJogada(0)).toBeNull();
  });
});

describe('folha de produção', () => {
  it('metros por bobina', () => {
    expect(porBobina([calha, rufo, peca('g', ['68'], '2')])).toEqual([
      { bobina: 10, metros: 3.3 },
      { bobina: 50, metros: 5.3 },
      { bobina: 120, metros: 2 },
    ]);
  });
  it('lista os acessórios e as bobinas', () => {
    const itens: Item[] = [{ id: 's', tipo: 'unidade', descricao: 'Silicone', unidade: 'un', quantidade: 2, precoUnit: 35 }];
    expect(notasProducao({ itens, pecas: [rufo] })).toEqual(['02 – Silicone', '', 'Bobina 10:  3,30 m']);
  });
});
