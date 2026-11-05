import { useEffect, useRef, useState } from 'react';
import { useRoute } from './lib/router';
import { useConfig } from './lib/hooks';
import { temPin } from './lib/pin';
import { Icon, ToastProvider } from './components/ui';
import { Lock } from './screens/Lock';
import { Inicio } from './screens/Inicio';
import { OrcamentosLista } from './screens/Orcamentos';
import { OrcamentoTela } from './screens/Orcamento';
import { ClienteDetalhe, ClienteForm, ClientesLista } from './screens/Clientes';
import { BackupTela, Calheiros, Empresa, Mais, Precos, TrocarPin } from './screens/Mais';

const BLOQUEIO_MS = 5 * 60 * 1000;

function useTema() {
  const { tema } = useConfig();
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const escuro = tema === 'escuro' || (tema === 'auto' && mq.matches);
      document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#141010' : '#f6f4f3');
    };
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
}

export default function App() {
  useTema();
  const [estado, setEstado] = useState<'carregando' | 'criar' | 'bloqueado' | 'livre'>('carregando');
  const saiuEm = useRef<number | null>(null);

  useEffect(() => {
    temPin().then((t) => setEstado(t ? 'bloqueado' : 'criar'));
  }, []);

  // bloqueia de novo depois de 5 min fora do app
  useEffect(() => {
    const f = () => {
      if (document.hidden) saiuEm.current = Date.now();
      else if (saiuEm.current && Date.now() - saiuEm.current > BLOQUEIO_MS) setEstado((e) => (e === 'livre' ? 'bloqueado' : e));
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  if (estado === 'carregando') return null;
  return (
    <ToastProvider>
      {estado === 'livre' ? <Shell onLock={() => setEstado('bloqueado')} /> : <Lock criar={estado === 'criar'} onOk={() => setEstado('livre')} />}
    </ToastProvider>
  );
}

function Shell({ onLock }: { onLock: () => void }) {
  const r = useRoute();
  const [a, b, c] = r;
  let tela: JSX.Element;
  let aba = 'inicio';
  let barra = false;

  switch (a) {
    case 'orcamentos': tela = <OrcamentosLista />; aba = 'orcamentos'; break;
    case 'orcamento': tela = <OrcamentoTela id={b} />; aba = 'orcamentos'; barra = true; break;
    case 'clientes': tela = <ClientesLista />; aba = 'clientes'; break;
    case 'cliente':
      aba = 'clientes';
      tela = b === 'novo' ? <ClienteForm /> : c === 'editar' ? <ClienteForm id={b} /> : <ClienteDetalhe id={b} />;
      break;
    case 'mais':
      aba = 'mais';
      tela = b === 'precos' ? <Precos /> : b === 'calheiros' ? <Calheiros /> : b === 'backup' ? <BackupTela /> : b === 'empresa' ? <Empresa /> : b === 'pin' ? <TrocarPin /> : <Mais onLock={onLock} />;
      break;
    default: tela = <Inicio />;
  }

  return (
    <>
      <main className={`app ${barra ? 'has-bar' : ''}`} key={r.join('/')}>{tela}</main>
      <div className="tabs"><nav aria-label="Seções">
        {[
          ['inicio', 'home', 'Início'],
          ['orcamentos', 'doc', 'Orçamentos'],
          ['clientes', 'users', 'Clientes'],
          ['mais', 'more', 'Mais'],
        ].map(([k, i, l]) => (
          <a key={k} href={`#/${k}`} aria-current={aba === k ? 'page' : undefined}><Icon name={i} />{l}</a>
        ))}
      </nav></div>
    </>
  );
}
