// Sincronização com a nuvem (Supabase).
// Os dados continuam no iPhone (rápido e funciona sem internet); a nuvem guarda uma cópia de tudo.
// Cada registro vira uma linha em "registros" (tabela, id, dados). Só o dono enxerga as próprias linhas (RLS).
import { createClient, type Session } from '@supabase/supabase-js';
import { db, getConfig, TABELAS_DADOS, type Config, type NomeTabela } from './db';
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from './nuvemConfig';

export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'calhas-andrade-nuvem' },
});

/** Configurações que são só deste aparelho e nunca vão para a nuvem. */
const SO_DESTE_APARELHO = ['pinHash', 'pinSalt', 'faceIdCred', 'ultimoBackup'] as const;
const CHAVE_ULTIMA = '__ultimaBusca';
const CHAVE_DONO = '__dono';

/** Impressão curta de um registro (para saber se mudou desde o último envio). */
export function marca(obj: unknown) {
  const s = JSON.stringify(obj);
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const configNuvem = (c: Config) => {
  const x: Record<string, unknown> = { ...c };
  SO_DESTE_APARELHO.forEach((k) => delete x[k]);
  return x;
};

type Local = { chave: string; tabela: NomeTabela | 'config'; id: string; dados: unknown };

async function lerLocal(): Promise<Local[]> {
  const out: Local[] = [];
  for (const t of TABELAS_DADOS) {
    for (const r of (await db.table(t).toArray()) as { id: string }[]) out.push({ chave: `${t}:${r.id}`, tabela: t, id: r.id, dados: r });
  }
  out.push({ chave: 'config:app', tabela: 'config', id: 'app', dados: configNuvem(await getConfig()) });
  return out;
}

export type EstadoNuvem = { conectado: boolean; email: string | null; ultima: string | null; erro: string | null; sincronizando: boolean; pendentes: number };

let estado: EstadoNuvem = { conectado: false, email: null, ultima: null, erro: null, sincronizando: false, pendentes: 0 };
const ouvintes = new Set<(e: EstadoNuvem) => void>();
const mudar = (p: Partial<EstadoNuvem>) => {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f(estado));
};
export const ouvirNuvem = (f: (e: EstadoNuvem) => void) => {
  ouvintes.add(f);
  f(estado);
  return () => ouvintes.delete(f);
};
export const estadoNuvem = () => estado;

let rodando: Promise<void> | null = null;
let deNovo = false;

/** Busca o que mudou na nuvem, aplica aqui, e manda o que mudou aqui. Seguro chamar várias vezes. */
export function sincronizar(): Promise<void> {
  if (rodando) {
    deNovo = true;
    return rodando;
  }
  rodando = (async () => {
    try {
      do {
        deNovo = false;
        await umaRodada();
      } while (deNovo);
    } finally {
      rodando = null;
    }
  })();
  return rodando;
}

async function umaRodada() {
  const { data: s } = await supabase.auth.getSession();
  const sess = s.session;
  if (!sess) return mudar({ conectado: false, email: null });
  if (!navigator.onLine) return mudar({ erro: 'Sem internet. Sincroniza quando voltar.' });
  mudar({ conectado: true, email: sess.user.email ?? null, sincronizando: true, erro: null });
  try {
    // outra conta neste aparelho: recomeça o controle (não apaga dados)
    const dono = await db.sync.get(CHAVE_DONO);
    if (dono?.marca !== sess.user.id) {
      await db.sync.clear();
      await db.sync.put({ chave: CHAVE_DONO, marca: sess.user.id });
    }

    // 1) buscar o que mudou na nuvem
    const ultima = (await db.sync.get(CHAVE_ULTIMA))?.marca ?? '1970-01-01T00:00:00Z';
    let maior = ultima;
    const remotos: { tabela: string; id: string; dados: unknown; apagado: boolean; atualizado_em: string }[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from('registros').select('tabela,id,dados,apagado,atualizado_em').gt('atualizado_em', ultima).order('atualizado_em').range(de, de + 999);
      if (error) throw error;
      remotos.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const enviados = new Map((await db.sync.toArray()).map((x) => [x.chave, x.marca]));
    const atuais = new Map((await lerLocal()).map((l) => [l.chave, l]));
    for (const r of remotos) {
      if (r.atualizado_em > maior) maior = r.atualizado_em;
      const chave = `${r.tabela}:${r.id}`;
      const local = atuais.get(chave);
      const mudouAqui = local ? marca(local.dados) !== enviados.get(chave) : enviados.has(chave);
      if (mudouAqui && enviados.has(chave)) continue; // mexeu aqui depois do último envio: o daqui vale (vai subir já já)
      if (r.tabela === 'config') {
        const atual = await getConfig();
        const novo = { ...atual, ...(r.dados as Partial<Config>) };
        SO_DESTE_APARELHO.forEach((k) => ((novo as Record<string, unknown>)[k] = atual[k]));
        await db.config.put({ key: 'app', value: novo });
        await db.sync.put({ chave, marca: marca(configNuvem(novo)) });
        continue;
      }
      if (!(TABELAS_DADOS as readonly string[]).includes(r.tabela)) continue;
      const t = db.table(r.tabela);
      if (r.apagado) {
        await t.delete(r.id);
        await db.sync.delete(chave);
      } else {
        await t.put(r.dados);
        await db.sync.put({ chave, marca: marca(r.dados) });
      }
    }
    await db.sync.put({ chave: CHAVE_ULTIMA, marca: maior });

    // 2) mandar o que mudou aqui
    const enviados2 = new Map((await db.sync.toArray()).map((x) => [x.chave, x.marca]));
    const locais = await lerLocal();
    const subir: { dono: string; tabela: string; id: string; dados: unknown; apagado: boolean }[] = [];
    const marcas: { chave: string; marca: string }[] = [];
    for (const l of locais) {
      const m = marca(l.dados);
      if (enviados2.get(l.chave) !== m) {
        subir.push({ dono: sess.user.id, tabela: l.tabela, id: l.id, dados: l.dados, apagado: false });
        marcas.push({ chave: l.chave, marca: m });
      }
    }
    const existem = new Set(locais.map((l) => l.chave));
    const apagar = [...enviados2.keys()].filter((k) => !k.startsWith('__') && !existem.has(k));
    for (const k of apagar) {
      const [tabela, ...resto] = k.split(':');
      subir.push({ dono: sess.user.id, tabela, id: resto.join(':'), dados: null, apagado: true });
    }
    mudar({ pendentes: subir.length });
    for (let i = 0; i < subir.length; i += 200) {
      const { error } = await supabase.from('registros').upsert(subir.slice(i, i + 200), { onConflict: 'dono,tabela,id' });
      if (error) throw error;
    }
    if (marcas.length) await db.sync.bulkPut(marcas);
    if (apagar.length) await db.sync.bulkDelete(apagar);
    mudar({ sincronizando: false, pendentes: 0, ultima: new Date().toISOString(), erro: null });
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    mudar({ sincronizando: false, erro: /fetch|network|Failed/i.test(msg) ? 'Sem conexão com a nuvem. Tenta de novo sozinho.' : `Erro na nuvem: ${msg}` });
  }
}

// ---------- conta ----------
const traduzir = (m: string) =>
  /invalid login/i.test(m) ? 'E-mail ou senha errados.'
    : /already registered|already exists/i.test(m) ? 'Esse e-mail já tem conta. Use “Já tenho conta”.'
      : /signups? not allowed|disabled/i.test(m) ? 'Cadastro fechado. Use “Já tenho conta”.'
        : /password/i.test(m) ? 'A senha precisa ter pelo menos 8 caracteres.'
          : /fetch|network/i.test(m) ? 'Sem internet.'
            : m;

export async function criarConta(email: string, senha: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
  if (error) throw new Error(traduzir(error.message));
  if (!data.session) throw new Error('Conta criada, mas precisa confirmar o e-mail.');
  await sincronizar();
}

export async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw new Error(traduzir(error.message));
  await sincronizar();
}

export async function sair() {
  await supabase.auth.signOut();
  mudar({ conectado: false, email: null, ultima: null, erro: null });
}

let agendado: number | undefined;
/** Sincroniza alguns segundos depois da última mudança (junta várias mudanças seguidas). */
export function agendarSincronizacao(ms = 2500) {
  window.clearTimeout(agendado);
  agendado = window.setTimeout(() => void sincronizar(), ms);
}

/** Liga a sincronização automática: ao abrir, ao voltar para o app, ao voltar a internet e a cada 5 minutos. */
export function iniciarNuvem() {
  supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
    if (data.session) {
      mudar({ conectado: true, email: data.session.user.email ?? null });
      void sincronizar();
    }
  });
  supabase.auth.onAuthStateChange((_ev, session) => mudar({ conectado: !!session, email: session?.user.email ?? null }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) agendarSincronizacao(500); });
  window.addEventListener('online', () => agendarSincronizacao(500));
  window.setInterval(() => void sincronizar(), 5 * 60 * 1000);
}
