// Avisos no celular: inscrição do aparelho (Web Push) guardada na nuvem.
import { supabase } from './nuvem';
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL, VAPID_PUBLICA } from './nuvemConfig';

export type Prefs = { manha: boolean; noite: boolean };

export const instaladoNaTela = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const suportaAvisos = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function registrarReceptor() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
}

const chave = (b64: string) => {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function inscricaoAtual() {
  if (!suportaAvisos()) return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Chamar DIRETO no toque do botão: o iPhone só mostra o pedido de permissão assim. */
export function pedirPermissao(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

export async function ativarAvisos(prefs: Prefs) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Ligue a nuvem primeiro (Mais → Nuvem).');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(VAPID_PUBLICA) }));
  const { error } = await supabase.from('push_inscricoes').upsert(
    { dono: data.user.id, endpoint: sub.endpoint, inscricao: sub.toJSON(), prefs, aparelho: /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'Outro' },
    { onConflict: 'dono,endpoint' },
  );
  if (error) throw new Error('Não consegui salvar na nuvem: ' + error.message);
}

export async function salvarPrefs(prefs: Prefs) {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await supabase.from('push_inscricoes').update({ prefs }).eq('endpoint', sub.endpoint);
}

export async function lerPrefs(): Promise<Prefs | null> {
  const sub = await inscricaoAtual();
  if (!sub) return null;
  const { data } = await supabase.from('push_inscricoes').select('prefs').eq('endpoint', sub.endpoint).maybeSingle();
  return (data?.prefs as Prefs) ?? null;
}

export async function desativarAvisos() {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await supabase.from('push_inscricoes').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function avisoDeTeste() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Ligue a nuvem primeiro.');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/avisos?modo=teste`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_CHAVE_PUBLICA },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? 'Falhou');
  return j.enviados as string[];
}
