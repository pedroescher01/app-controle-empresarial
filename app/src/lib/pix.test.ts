import { describe, expect, it } from 'vitest';
import { crc16, normalizarChave, pixCopiaECola, qrMatriz } from './pix';

describe('Pix copia e cola', () => {
  it('CRC igual ao exemplo oficial do Banco Central', () => {
    const corpo = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(corpo)).toBe('1D3D');
  });
  it('chave CPF vai só com números', () => {
    expect(normalizarChave('474.665.198-14')).toBe('47466519814');
    expect(normalizarChave('16.693.515/0001-54')).toBe('16693515000154');
    expect(normalizarChave('(19) 98959-0119')).toBe('+5519989590119');
    expect(normalizarChave('Calhas@Gmail.com')).toBe('calhas@gmail.com');
  });
  it('monta o código com valor, nome e cidade', () => {
    const c = pixCopiaECola({ chave: '474.665.198-14', nome: 'Pedro Rubini Escher', cidade: 'Araras', valor: 1230, txid: 'ORC5490' });
    expect(c).toContain('0014br.gov.bcb.pix011147466519814');
    expect(c).toContain('54071230.00');
    expect(c).toContain('5919PEDRO RUBINI ESCHER');
    expect(c).toContain('6006ARARAS');
    expect(c).toContain('62110507ORC5490');
    expect(c.slice(-8, -4)).toBe('6304');
    expect(c.slice(-4)).toBe(crc16(c.slice(0, -4)));
  });
  it('tira acentos e respeita os tamanhos', () => {
    const c = pixCopiaECola({ chave: '47466519814', nome: 'João da Conceição Ãçêntuado Muito Comprido', cidade: 'São José do Rio Pardo', valor: 0.3 });
    expect(c).toContain('5925JOAO DA CONCEICAO ACENTU');
    expect(c).toContain('6015SAO JOSE DO RIO');
    expect(c).toContain('54040.30');
  });
  it('gera a matriz do QR', () => {
    const m = qrMatriz(pixCopiaECola({ chave: '47466519814', nome: 'Pedro', cidade: 'Araras', valor: 10 }));
    expect(m.length).toBeGreaterThan(20);
  });
});
