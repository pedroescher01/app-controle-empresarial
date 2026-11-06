// Avisos no celular (Web Push) — roda no Supabase.
// ?modo=manha  → resumo do dia (7h30)       ?modo=noite → o que tem amanhã (18h30)
// ?modo=teste  → manda um aviso de teste só para quem chamou (precisa estar logado)
// &simular=1   → não manda nada, só devolve os textos (para conferir)
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type Reg = { tabela: string; dados: any };
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails('mailto:calhasandradeararas@gmail.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

// ---------- datas no horário de Brasília ----------
const pad = (n: number) => String(n).padStart(2, '0');
const isoBR = (d: Date) => { const x = new Date(d.getTime() - 3 * 3600_000); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
const addDias = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
const diaSemana = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86400000);

/** A conta vence nesse dia? */
function venceEm(c: any, dia: string) {
  if (c.repete === 'unica') return c.vencimento === dia;
  if (!c.ativa || dia < String(c.criadoEm).slice(0, 10)) return false;
  if (c.repete === 'semanal') return diaSemana(dia) === c.dia;
  const [y, m] = dia.split('-').map(Number);
  return Number(dia.slice(8, 10)) === Math.min(c.dia, ultimoDia(y, m));
}
const paga = (c: any, dia: string, lancs: any[]) => lancs.some((l) => l.contaFixaId === c.id && l.referencia === dia);

function avisos(regs: Reg[], modo: 'manha' | 'noite', hoje: string) {
  const de = (t: string) => regs.filter((r) => r.tabela === t).map((r) => r.dados);
  const visitas = de('visitas'), orcs = de('orcamentos'), contas = de('contasFixas'), lancs = de('lancamentos'), pedidos = de('pedidos');
  const dia = modo === 'manha' ? hoje : addDias(hoje, 1);
  const per = (p: string | null) => (p === 'manha' ? ' (manhã)' : p === 'tarde' ? ' (tarde)' : '');
  const linhas: string[] = [];

  const medir = visitas.filter((v) => v.status === 'a_medir' && v.data === dia);
  if (medir.length) linhas.push(`📍 Medir: ${medir.map((v) => v.nome + per(v.periodo)).join(', ')}`);
  const serv = orcs.filter((o) => o.servicoData === dia && o.status !== 'recusado' && !o.juntadoNo);
  if (serv.length) linhas.push(`🔧 Serviço: ${serv.map((o) => o.clienteNome + per(o.servicoPeriodo)).join(', ')}`);
  const vencem = contas.filter((c) => venceEm(c, dia) && !paga(c, dia, lancs));
  if (vencem.length) linhas.push(`💰 Vence ${modo === 'manha' ? 'hoje' : 'amanhã'}: ${vencem.map((c) => `${c.descricao} ${brl(c.valor)}`).join(', ')}`);

  if (modo === 'manha') {
    // contas atrasadas (últimos 31 dias)
    const atrasadas: string[] = [];
    for (let i = 1; i <= 31; i++) {
      const d = addDias(hoje, -i);
      contas.filter((c) => venceEm(c, d) && !paga(c, d, lancs)).forEach((c) => atrasadas.push(`${c.descricao} (${ddmm(d)})`));
    }
    if (atrasadas.length) linhas.push(`⚠️ Atrasada${atrasadas.length > 1 ? 's' : ''}: ${atrasadas.slice(0, 3).join(', ')}${atrasadas.length > 3 ? '…' : ''}`);
    const fila = visitas.filter((v) => v.status === 'a_medir');
    if (fila.length) {
      const velha = fila.reduce((m, v) => (v.criadoEm < m ? v.criadoEm : m), fila[0].criadoEm);
      linhas.push(`🪜 ${fila.length} visita${fila.length > 1 ? 's' : ''} a medir · a mais antiga há ${diasEntre(velha, hoje)} dias`);
    }
    const semResp = orcs.filter((o) => o.status === 'enviado' && !o.juntadoNo && !(o.pagamentos ?? []).length && diasEntre(o.enviadoEm ?? o.emitidoEm, hoje) >= 5);
    if (semResp.length) linhas.push(`📨 ${semResp.length} orçamento${semResp.length > 1 ? 's' : ''} sem resposta: ${semResp.slice(0, 3).map((o) => o.clienteNome).join(', ')}`);
    const chegouSemPagar = pedidos.filter((p) => p.chegouEm && !p.pagoEm);
    if (chegouSemPagar.length) linhas.push(`🚚 Pedido de bobinas chegou e falta pagar`);
  }
  if (!linhas.length) return null;
  return {
    title: modo === 'manha' ? 'Bom dia! Hoje na Calhas Andrade' : 'Amanhã na Calhas Andrade',
    body: linhas.join('\n'),
    url: vencem.length && !medir.length && !serv.length ? '#/financeiro' : '#/inicio',
  };
}

async function enviar(sub: any, msg: { title: string; body: string; url: string }) {
  try {
    await webpush.sendNotification(sub.inscricao, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'normal' });
    return 'ok';
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from('push_inscricoes').delete().eq('dono', sub.dono).eq('endpoint', sub.endpoint);
      return 'inscrição vencida (removida)';
    }
    return `erro ${e?.statusCode ?? ''} ${e?.body ?? e?.message ?? e}`;
  }
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  const url = new URL(req.url);
  const modo = (url.searchParams.get('modo') ?? '') as 'manha' | 'noite' | 'teste';
  const simular = url.searchParams.get('simular') === '1';
  const hoje = url.searchParams.get('hoje') ?? isoBR(new Date());

  if (modo === 'teste') {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ erro: 'precisa estar logado' }, 401);
    const { data: subs } = await admin.from('push_inscricoes').select('*').eq('dono', data.user.id);
    const res = [];
    for (const s of subs ?? []) res.push(await enviar(s, { title: 'Calhas Andrade', body: 'Pronto! Os avisos estão funcionando neste celular. ✅', url: '#/mais/avisos' }));
    return json({ enviados: res });
  }

  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ erro: 'não autorizado' }, 401);
  if (modo !== 'manha' && modo !== 'noite') return json({ erro: 'modo inválido' }, 400);

  const { data: subs, error } = await admin.from('push_inscricoes').select('*');
  if (error) return json({ erro: error.message }, 500);
  const porDono = new Map<string, any[]>();
  for (const s of subs ?? []) if (s.prefs?.[modo] !== false) porDono.set(s.dono, [...(porDono.get(s.dono) ?? []), s]);

  const saida: unknown[] = [];
  for (const [dono, lista] of porDono) {
    const regs: Reg[] = [];
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from('registros').select('tabela,dados').eq('dono', dono).eq('apagado', false)
        .in('tabela', ['visitas', 'orcamentos', 'contasFixas', 'lancamentos', 'pedidos']).range(de, de + 999);
      regs.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const msg = avisos(regs, modo, hoje);
    if (!msg) { saida.push({ dono, aviso: null }); continue; }
    const res = simular ? ['simulado'] : await Promise.all(lista.map((s) => enviar(s, msg)));
    saida.push({ dono, aviso: msg, res });
  }
  return json({ modo, hoje, saida });
});
