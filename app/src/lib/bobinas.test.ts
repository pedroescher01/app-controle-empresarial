import { describe, expect, it } from 'vitest';
import { bobinasParaComprar, estadoBobina, listaPrioridade, prioridade, historicoPreco, mensagemPedido, statusPedido, variacao } from './bobinas';
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

describe('prioridade de compra', () => {
  const b = (corte: number, estado: Bobina['estado'], producao?: Bobina['producao']): Bobina => ({ id: `26-${corte}`, chapa: 26, corte, estado, producao, atualizadoEm: '' });
  it('urgente, repor, de olho e ok', () => {
    const bobs = [b(28, 'comprar', 'afinando'), b(10, 'comprar', 'bastante'), b(33, 'ok', 'acabando'), b(22, 'ok', 'afinando')];
    expect(prioridade(bobs, [], 26, 28)).toBe('urgente');
    expect(prioridade(bobs, [], 26, 10)).toBe('repor');
    expect(prioridade(bobs, [], 26, 33)).toBe('olho');
    expect(prioridade(bobs, [], 26, 22)).toBe('ok');
    expect(prioridade(bobs, [], 26, 45)).toBe('ok');
  });
  it('lista por prioridade', () => {
    const l = listaPrioridade([b(28, 'comprar', 'acabando'), b(30, 'comprar', 'afinando'), b(10, 'comprar')], []);
    expect(l.urgente.map((i) => i.corte)).toEqual([28, 30]);
    expect(l.repor.map((i) => i.corte)).toEqual([10]);
  });
});

describe('peso das bobinas', () => {
  const nota = (id: string, itens: Pedido['itens'], precoKg26 = 10) => ped({ id, numero: Number(id.slice(1)), itens, notaEm: '2026-10-01', pedidoEm: '2026-09-28', chegouEm: '2026-10-02', precoKg26 });
  const hist = [
    nota('p1', [{ chapa: 26, corte: 33, quantidade: 2, pesos: [300, 310] }, { chapa: 26, corte: 50, quantidade: 1, pesos: [460] }]),
    nota('p2', [{ chapa: 26, corte: 33, quantidade: 1, pesos: [305] }], 11),
  ];
  it('média, mínimo e máximo por corte', async () => {
    const { pesosPorCorte } = await import('./bobinas');
    expect(pesosPorCorte(hist)).toEqual([
      { chapa: 26, corte: 33, media: 305, min: 300, max: 310, n: 3 },
      { chapa: 26, corte: 50, media: 460, min: 460, max: 460, n: 1 },
    ]);
  });
  it('corte sem histórico usa a largura; aviso de bobina fora do normal', async () => {
    const { pesosPorCorte, pesoEsperado, foraDoNormal } = await import('./bobinas');
    const ps = pesosPorCorte(hist);
    const e = pesoEsperado(ps, 26, 40)!;
    expect(e.pelaLargura).toBe(true);
    expect(Math.round(e.kg)).toBe(Math.round(((305 * 3 + 460) / (33 * 3 + 50)) * 40));
    expect(foraDoNormal(ps, 26, 33, 312)).toBeNull();
    expect(foraDoNormal(ps, 26, 33, 250)?.texto).toBe('veio leve: 18,03% abaixo da média (305 kg)');
  });
  it('previsão do pedido com o último preço do kg', async () => {
    const { previsaoPedido } = await import('./bobinas');
    const r = previsaoPedido(ped({ id: 'novo', itens: [{ chapa: 26, corte: 33, quantidade: 2 }, { chapa: 24, corte: 50, quantidade: 1 }] }), hist)!;
    expect(r.kg).toBe(610);
    expect(r.valor).toBe(6710);
    expect(r.semPeso).toBe(1);
  });
});
