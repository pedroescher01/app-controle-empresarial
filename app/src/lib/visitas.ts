import type { Calheiro, Visita } from './db';
import { mapsLink } from './format';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ESCADA = { normal: 'normal', alta: 'alta', muito_alta: 'muito alta (barracão)' } as const;

/** Endereço para o mapa: sem cidade no texto, é Araras. */
export function enderecoMapa(endereco: string) {
  const e = endereco.trim();
  if (!e) return '';
  return e.split(' - ').length < 3 ? `${e}, Araras - SP` : `${e}, SP`;
}

function quandoTexto(v: Visita, hoje: string) {
  if (!v.data) return null;
  const [a, m, d] = v.data.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const dia = v.data === hoje ? 'hoje' : `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  return `${dia}${v.periodo ? (v.periodo === 'manha' ? ' de manhã' : ' à tarde') : ''}`;
}

/** Mensagem para avisar os calheiros que tem uma visita para olhar. */
export function mensagemCalheiro(v: Visita, cal: Calheiro | null, hoje: string) {
  const precisa = [v.precisa.join(', '), v.detalhe.trim()].filter(Boolean).join(' · ');
  const quando = quandoTexto(v, hoje);
  const linhas = [
    cal ? `Olá, ${cal.nome.split(' ')[0]}! Tem uma visita para olhar:` : 'Tem uma visita para olhar:',
    '',
    `*Cliente:* ${v.nome.trim() || 'Sem nome'}`,
    ...(v.telefone ? [`*Telefone:* ${v.telefone}`] : []),
    ...(v.endereco.trim() ? [`*Endereço:* ${v.endereco.trim()}`, `*Mapa:* ${mapsLink(enderecoMapa(v.endereco))}`] : []),
    ...(precisa ? [`*Precisa ver:* ${precisa}`] : []),
    `*Escada:* ${ESCADA[v.escada]}`,
    ...(quando ? [`*Combinado:* ${quando}`] : []),
    '',
    'Se estiver por perto, passa lá para dar uma olhada e me avisa. Obrigado!',
  ];
  return linhas.join('\n');
}
