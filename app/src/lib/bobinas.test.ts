import { describe, expect, it } from 'vitest';
import { bobinasParaComprar, estadoBobina, historicoPreco, mensagemPedido, statusPedido, variacao } from './bobinas';
import type { Bobina, Pedido } from './db';

const bob = (chapa: 24 | 26, corte: number, estado: Bobina['estado'] = 'comprar'): Bobina => ({ id: `${chapa}-${corte}`, chapa, corte, estado, atualizadoEm: '' });
const ped = (p: Partial<Pedido>): Pedido => ({
  id: 'p', numero: 1, fornecedorId: 'f', itens: [], observacoes: '', pedidoEm: null, notaEm: null, chegouEm: null, pagoEm: null,
  valorTotal: null, pesoKg: null, precoKg26: null, precoKg24: null, formaPagamento: 'Pix', contaPagamento: 'Sicoob', criadoEm: '', atualizadoEm: '', ...p,
});

describe('bobinas', () => {
  it('estado: ok por padrão, comprar quando marcada, pedida quando está num pedido aberto', () => {
    const bobs = [bob(26, 33), bob(26, 40)];
    const pedidos = [ped({ itens: [{ chapa: 26, corte: 40, quantidade: 1 }], pedidoEm: '2026-11-03' })];
    expect(estadoBobina(bobs, pedidos, 26, 25)).toBe('ok');
    expect(estadoBobina(bobs, pedidos, 26, 33)).toBe('comprar');
    expect(estadoBobina(bobs, pedidos, 26, 40)).toBe('pedida');
  });
  it('para comprar: não repete o que já está em pedido (aberto ou rascunho)', () => {
    const bobs = [bob(26, 33), bob(26, 40), bob(24, 50)];
    const pedidos = [ped({ itens: [{ chapa: 26, corte: 40, quantidade: 1 }] })];
    expect(bobinasParaComprar(bobs, pedidos)).toEqual([
      { chapa: 26, corte: 33, quantidade: 1 },
      { chapa: 24, corte: 50, quantidade: 1 },
    ]);
  });
  it('depois que chega, a bobina deixa de ser "pedida"', () => {
    const pedidos = [ped({ itens: [{ chapa: 26, corte: 40, quantidade: 1 }], pedidoEm: '2026-11-03', chegouEm: '2026-11-06' })];
    expect(estadoBobina([bob(26, 40, 'ok')], pedidos, 26, 40)).toBe('ok');
  });
  it('etapas do pedido', () => {
    expect(statusPedido(ped({})).rotulo).toBe('A pedir');
    expect(statusPedido(ped({ pedidoEm: 'x' })).rotulo).toBe('Pedido · aguardando carga');
    expect(statusPedido(ped({ pedidoEm: 'x', notaEm: 'x' })).rotulo).toBe('Nota recebida');
    expect(statusPedido(ped({ pedidoEm: 'x', chegouEm: 'x' })).rotulo).toBe('Chegou · falta pagar');
    expect(statusPedido(ped({ pedidoEm: 'x', chegouEm: 'x', pagoEm: 'x' })).rotulo).toBe('Concluído');
  });
  it('mensagem do WhatsApp', () => {
    const m = mensagemPedido(ped({ itens: [{ chapa: 24, corte: 50, quantidade: 1 }, { chapa: 26, corte: 33, quantidade: 2 }] }), { id: 'f', nome: 'Galvisa', cnpj: '', vendedor: 'Rafael Souza', telefone: '', criadoEm: '' });
    expect(m).toContain('Olá, Rafael!');
    expect(m.indexOf('corte 33')).toBeLessThan(m.indexOf('corte 50'));
    expect(m).toContain('• 2 bobinas corte 33 · chapa 26 (0,47 mm)');
    expect(m).toContain('• 1 bobina corte 50 · chapa 24 (0,60 mm)');
  });
  it('histórico e variação do preço do quilo', () => {
    const pts = historicoPreco([
      ped({ numero: 2, notaEm: '2026-10-10', precoKg26: 9.2 }),
      ped({ numero: 3, notaEm: '2026-11-04', precoKg26: 9.6, precoKg24: 9.9 }),
    ]);
    expect(pts.map((p) => [p.data, p.chapa, p.precoKg])).toEqual([['2026-10-10', 26, 9.2], ['2026-11-04', 26, 9.6], ['2026-11-04', 24, 9.9]]);
    expect(variacao(pts, 26)?.texto).toBe('subiu 4,35%');
    expect(variacao(pts, 24)).toBeNull();
  });
  it('duas notas no mesmo dia: compara na ordem dos pedidos', () => {
    const pts = historicoPreco([ped({ numero: 2, notaEm: '2026-11-06', precoKg26: 10.1 }), ped({ numero: 1, notaEm: '2026-11-06', precoKg26: 9.6 })]);
    expect(variacao(pts, 26)?.texto).toBe('subiu 5,21%');
  });
});
