import { describe, expect, it } from 'vitest';
import { enderecoMapa, mensagemCalheiro } from './visitas';
import type { Visita } from './db';

const v: Visita = { id: 'x', clienteId: null, nome: 'Renata', telefone: '(19) 99699-9870', endereco: 'Rua Marcone, 361 - Bom Jesus', precisa: ['Calha', 'Rufo'], detalhe: '', escada: 'alta', status: 'a_medir', data: null, periodo: null, calheiroId: null, medidoEm: null, orcamentoId: null, criadoEm: '', atualizadoEm: '' };

describe('mensagem para os calheiros', () => {
  it('traz nome, telefone, endereço, mapa, o que precisa e a escada', () => {
    const m = mensagemCalheiro(v, { id: 'c', nome: 'Zé Carlos', telefone: '', ativo: true, criadoEm: '' }, '2026-11-06');
    expect(m).toContain('Olá, Zé! Tem uma visita para olhar:');
    expect(m).toContain('*Cliente:* Renata');
    expect(m).toContain('*Telefone:* (19) 99699-9870');
    expect(m).toContain('*Endereço:* Rua Marcone, 361 - Bom Jesus');
    expect(m).toContain('query=Rua%20Marcone%2C%20361%20-%20Bom%20Jesus%2C%20Araras%20-%20SP');
    expect(m).toContain('*Precisa ver:* Calha, Rufo');
    expect(m).toContain('*Escada:* alta');
    expect(m).not.toContain('Combinado');
  });
  it('com data combinada e sem calheiro escolhido', () => {
    const m = mensagemCalheiro({ ...v, data: '2026-11-09', periodo: 'tarde', detalhe: 'vazando na frente' }, null, '2026-11-06');
    expect(m.startsWith('Tem uma visita para olhar:')).toBe(true);
    expect(m).toContain('*Combinado:* segunda, 09/11 à tarde');
    expect(m).toContain('*Precisa ver:* Calha, Rufo · vazando na frente');
  });
  it('cidade no endereço', () => {
    expect(enderecoMapa('Rua A, 1 - Centro - Conchal')).toBe('Rua A, 1 - Centro - Conchal, SP');
  });
});
