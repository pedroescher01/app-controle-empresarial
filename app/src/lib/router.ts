import { useEffect, useState } from 'react';

/** Rotas por hash (#/orcamento/abc). Funciona em hospedagem estática. */
const parse = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('/').filter(Boolean);

export function useRoute(): string[] {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const go = (path: string) => {
  location.hash = '#/' + path.replace(/^\/+/, '');
};

/** Troca a rota sem criar entrada no histórico (ex.: depois de criar um registro). */
export const replace = (path: string) => {
  history.replaceState(null, '', '#/' + path.replace(/^\/+/, ''));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};
