import { getConfig, setConfig } from './db';

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function temPin() {
  return !!(await getConfig()).pinHash;
}

export async function definirPin(pin: string) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await setConfig({ pinSalt: salt, pinHash: await sha256(salt + pin) });
}

export async function conferirPin(pin: string) {
  const c = await getConfig();
  if (!c.pinHash || !c.pinSalt) return false;
  return (await sha256(c.pinSalt + pin)) === c.pinHash;
}
