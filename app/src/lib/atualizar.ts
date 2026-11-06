declare const __VERSAO__: string;

/** Confere se há versão nova publicada e recarrega o app (sem perder dados: eles ficam no aparelho). */
export async function conferirAtualizacao(): Promise<boolean> {
  if (import.meta.env.DEV) return false;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}versao.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const { versao } = await r.json();
    if (versao && versao !== __VERSAO__) {
      // endereço com ?v= para o iPhone não usar a página guardada em cache (até 10 min no GitHub Pages)
      let tentou = '';
      try { tentou = sessionStorage.getItem('atualizando') ?? ''; } catch { /* sem storage */ }
      if (tentou === versao && new URLSearchParams(location.search).get('v') === versao) return false; // já tentou: evita ficar recarregando
      try { sessionStorage.setItem('atualizando', versao); } catch { /* sem storage */ }
      location.replace(`${location.pathname}?v=${encodeURIComponent(versao)}${location.hash}`);
      return true;
    }
  } catch {
    /* sem internet: segue com a versão atual */
  }
  return false;
}

export const VERSAO_ATUAL = typeof __VERSAO__ === 'string' ? __VERSAO__ : '';
