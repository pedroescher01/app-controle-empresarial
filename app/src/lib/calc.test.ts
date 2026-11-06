import { describe, expect, it } from 'vitest';
import { calcular, linhasObservacoes, nomeClientePDF, nomeArquivo, enderecoTexto } from './calc';
import type { Item, Orcamento } from './db';
import { parseDecimal, maskPhone, maskCNPJ } from './format';

const cfg = { precoMetro: 60, fatorChapa24: 1.5 };
const item = (p: Partial<Item>): Item => ({ id: Math.random().toString(), tipo: 'unidade', descricao: 'x', unidade: 'un', quantidade: 1, precoUnit: 0, ...p });

describe('calcular', () => {
  it('corte × preço do metro × metragem', () => {
    const r = calcular({ itens: [item({ tipo: 'metro', corte: 33, quantidade: 10, unidade: 'm' })], desconto: 0, totalDesejado: null }, cfg);
    expect(r.total).toBe(198);
  });
  it('chapa 24 é 50% mais cara', () => {
    const r = calcular({ itens: [item({ tipo: 'metro', corte: 33, chapa: 24, quantidade: 10 })], desconto: 0, totalDesejado: null }, cfg);
    expect(r.total).toBe(297);
  });
  it('"Fechar em" bate até o centavo e só mexe em itens por metro', () => {
    const itens = [
      item({ tipo: 'metro', corte: 33, quantidade: 42 }),
      item({ tipo: 'metro', corte: 25, quantidade: 18 }),
      item({ tipo: 'unidade', condutor: true, quantidade: 6, precoUnit: 25 }),
      item({ quantidade: 3, precoUnit: 35 }),
    ];
    const r = calcular({ itens, desconto: 0, totalDesejado: 1500 }, cfg);
    expect(r.total).toBe(1500);
    expect(r.linhas[2].total).toBe(150);
    expect(r.linhas[3].total).toBe(105);
    expect(r.linhas[0].ajuste + r.linhas[1].ajuste).toBeCloseTo(1500 - r.subtotalBase, 2);
  });
  it('diferença ímpar em centavos', () => {
    const itens = [item({ tipo: 'metro', corte: 33, quantidade: 1 }), item({ tipo: 'metro', corte: 33, quantidade: 1 }), item({ tipo: 'metro', corte: 33, quantidade: 1 })];
    const r = calcular({ itens, desconto: 0, totalDesejado: 100 }, cfg);
    expect(r.total).toBe(100);
  });
  it('Fechar em com desconto: total final é o desejado', () => {
    const r = calcular({ itens: [item({ tipo: 'metro', corte: 33, quantidade: 10 })], desconto: 50, totalDesejado: 300 }, cfg);
    expect(r.total).toBe(300);
    expect(r.subtotal).toBe(350);
  });
  it('sem calha/rufo não dá para fechar', () => {
    const r = calcular({ itens: [item({ quantidade: 2, precoUnit: 10 })], desconto: 0, totalDesejado: 50 }, cfg);
    expect(r.ajusteImpossivel).toBe(true);
    expect(r.total).toBe(20);
  });
});

const orc = (p: Partial<Orcamento>): Orcamento => ({
  id: '1', numero: 364, clienteId: null, clienteNome: 'Edgar', telefone: '', endereco: 'Leme', calheiroIds: [], modo: 'detalhado', itens: [], desconto: 0,
  totalDesejado: null, valorAVista: null, observacoes: '', status: 'aprovado', emitidoEm: '2026-09-24', validoAte: null, enviadoEm: null, aprovadoEm: null,
  parcelas: 1, pagamentos: [], criadoEm: '', atualizadoEm: '', ...p,
});

describe('textos', () => {
  it('nome com calheiro e sem calheiro', () => {
    const cal = [{ id: 'a', nome: 'Dalvo', telefone: '', ativo: true, criadoEm: '' }, { id: 'b', nome: 'Miguel', telefone: '', ativo: true, criadoEm: '' }];
    expect(nomeClientePDF(orc({ clienteNome: 'Gecionete França', calheiroIds: ['a', 'b'] }), cal)).toBe('Gecionete França - (Dalvo e Miguel)');
    expect(nomeClientePDF(orc({ clienteNome: 'Ivan' }), cal)).toBe('Ivan - (Ivan)');
  });
  it('pagamento quitado igual ao modelo do Edgar', () => {
    const o = orc({ pagamentos: [{ id: 'p', data: '2026-10-02', valor: 850, forma: 'Pix', conta: 'Sicoob' }] });
    const { linhas, quitado } = linhasObservacoes(o, 850);
    expect(linhas).toEqual(['Parcela 1 de 1 - paga em 02/10/2026 - R$ 850,00 (Pix) - orçamento quitado.']);
    expect(quitado).toBe(true);
    expect(nomeArquivo(o, true)).toBe('Orçamento 364 - Edgar - PAGO.pdf');
  });
  it('parcial: sem linha de total e sem "1 de 1"', () => {
    const o = orc({ parcelas: 1, valorAVista: 1000, pagamentos: [{ id: 'p', data: '2026-11-05', valor: 300, forma: 'Pix', conta: 'Sicoob' }] });
    expect(linhasObservacoes(o, 1120).linhas).toEqual(['Parcela 1 de 2 - paga em 05/11/2026 - R$ 300,00 (Pix) - falta R$ 820,00']);
  });
  it('mão de obra paga direto ao calheiro aparece com o nome dele', () => {
    const o = orc({ parcelas: 2, pagamentos: [
      { id: 'a', data: '2026-11-10', valor: 1230, forma: 'Pix', conta: 'Sicoob' },
      { id: 'b', data: '2026-11-12', valor: 1100, forma: 'Direto ao calheiro', conta: 'Marquinhos' },
    ] });
    expect(linhasObservacoes(o, 2330).linhas).toEqual([
      'Parcela 1 de 2 - paga em 10/11/2026 - R$ 1.230,00 (Pix) - falta R$ 1.100,00',
      'Parcela 2 de 2 - paga em 12/11/2026 - R$ 1.100,00 (direto ao Marquinhos) - orçamento quitado.',
    ]);
  });
  it('à vista aparece só antes de pagar', () => {
    expect(linhasObservacoes(orc({ valorAVista: 1000 }), 1120).linhas).toEqual(['Em caso de pagamento à vista, o valor será R$ 1.000,00.']);
  });
  it('endereço', () => {
    expect(enderecoTexto({ logradouro: 'Rua Flávio Mesquita', numero: '895', bairro: 'Jardim Cândida', cidade: 'Araras', uf: 'SP' })).toBe('Rua Flávio Mesquita, 895 - Jardim Cândida');
    expect(enderecoTexto({ logradouro: '', numero: '', bairro: '', cidade: 'Leme', uf: 'SP' })).toBe('Leme');
  });
});

describe('formatos', () => {
  it('números e máscaras', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal('1.250,75')).toBe(1250.75);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(maskPhone('19989590119')).toBe('(19) 98959-0119');
    expect(maskPhone('1935412290')).toBe('(19) 3541-2290');
    expect(maskCNPJ('16693515000154')).toBe('16.693.515/0001-54');
  });
});
