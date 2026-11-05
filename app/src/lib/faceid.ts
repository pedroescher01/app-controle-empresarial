// Entrar com Face ID usando a chave-senha (WebAuthn) do próprio iPhone.
// Não há servidor: a chave fica no aparelho e o Face ID é exigido a cada entrada
// (userVerification: 'required'). O PIN continua valendo como reserva.
import { getConfig, setConfig } from './db';

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function faceIdDisponivel(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function faceIdAtivo() {
  return !!(await getConfig()).faceIdCred;
}

export async function ativarFaceId(): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'Calhas Andrade' },
      user: { id: aleatorio(16), name: 'Pedro', displayName: 'Pedro · Calhas Andrade' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Face ID não foi ativado.');
  await setConfig({ faceIdCred: b64(cred.rawId) });
}

export async function desativarFaceId() {
  await setConfig({ faceIdCred: null });
}

/** Pede o Face ID. Retorna true só se o iPhone confirmou que é você. */
export async function entrarComFaceId(): Promise<boolean> {
  const id = (await getConfig()).faceIdCred;
  if (!id) return false;
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(32),
      allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred || b64(cred.rawId) !== id) return false;
  const auth = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
  return (auth[32] & 0x04) !== 0; // bit "usuário verificado" (Face ID / código do iPhone)
}
