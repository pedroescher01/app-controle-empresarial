import { useEffect, useRef, useState } from 'react';
import { useRoute } from './lib/router';
import { useConfig, useVisitas } from './lib/hooks';
import { temPin } from './lib/pin';
import { conferirAtualizacao } from './lib/atualizar';
import { Icon, ToastProvider } from './components/ui';
import { Lock } from './screens/Lock';
import { Inicio } from './screens/Inicio';
import { OrcamentosLista } from './screens/Orcamentos';
import { OrcamentoTela } from './screens/Orcamento';
import { ClienteDetalhe, ClienteForm, ClientesLista } from './screens/Clientes';
import { VisitaForm, VisitasLista } from './screens/Visitas';
import { ContasFixas, Financeiro, FinanceiroAno } from './screens/Financeiro';
import { Bobinas, Fornecedores, PedidoTela, PrecoKg } from './screens/Bobinas';
import { Juntar } from './screens/Juntar';
import { Nuvem } from './screens/Nuvem';
import { Avisos } from './screens/Avisos';
import { BackupTela, Calheiros, Empresa, Mais, Precos, TrocarPin } from './screens/Mais';

const BLOQUEIO_MS = 5 * 60 * 1000;

/**
 * No iPhone, as barras fixas embaixo (abas e total) se perdem quando o teclado abre/fecha
 * e ficam "soltas" no meio da tela. Enquanto o teclado estiver aberto, elas ficam escondidas.
 */
function useTeclado() {
  useEffect(() => {
    const ehCampo = (el: Element | null) =>
      !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'file', 'submit'].includes((el as HTMLInputElement).type)));
    let t: number | undefined;
    const atualizar = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const vv = window.visualViewport;
        const aberto = ehCampo(document.activeElement) || (!!vv && vv.height < window.innerHeight * 0.8);
        const antes = document.body.classList.contains('kb');
        document.body.classList.toggle('kb', aberto);
        // ao fechar o teclado, força o iPhone a recalcular a posição das barras
        if (antes && !aberto) window.scrollTo(window.scrollX, window.scrollY);
      }, 60);
    };
    // posição e altura da área visível (o teclado do iPhone encolhe essa área)
    const medir = () => {
      const vv = window.visualViewport;
      const r = document.documentElement.style;
      r.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`);
      r.setProperty('--vv-h', `${vv ? vv.height : window.innerHeight}px`);
    };
    medir();
    const tudo = () => { medir(); atualizar(); };
    document.addEventListener('focusin', atualizar);
    document.addEventListener('focusout', atualizar);
    window.visualViewport?.addEventListener('resize', tudo);
    window.visualViewport?.addEventListener('scroll', medir);
    window.addEventListener('resize', medir);
    return () => {
      document.removeEventListener('focusin', atualizar);
      document.removeEventListener('focusout', atualizar);
      window.visualViewport?.removeEventListener('resize', tudo);
      window.visualViewport?.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, []);
}

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
  useTeclado();
  const [estado, setEstado] = useState<'carregando' | 'criar' | 'bloqueado' | 'livre'>('carregando');
  const saiuEm = useRef<number | null>(null);

  useEffect(() => {
    temPin().then((t) => setEstado(t ? 'bloqueado' : 'criar'));
    conferirAtualizacao();
  }, []);

  // bloqueia de novo depois de 5 min fora do app
  useEffect(() => {
    const f = () => {
      if (document.hidden) {
        saiuEm.current = Date.now();
        return;
      }
      if (saiuEm.current && Date.now() - saiuEm.current > BLOQUEIO_MS) setEstado((e) => (e === 'livre' ? 'bloqueado' : e));
      // versão nova publicada: atualiza, mas nunca no meio de uma digitação ou janela aberta
      if (!document.querySelector('input:focus, textarea:focus, .sheet')) conferirAtualizacao();
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
  const aMedir = useVisitas().filter((v) => v.status === 'a_medir').length;
  let tela: JSX.Element;
  let aba = 'inicio';
  let barra = false;

  switch (a) {
    case 'visitas': tela = <VisitasLista aba={b ?? ''} />; aba = 'visitas'; break;
    case 'visita': tela = b === 'nova' ? <VisitaForm /> : <VisitaForm id={b} />; aba = 'visitas'; break;
    case 'orcamentos': tela = <OrcamentosLista />; aba = 'orcamentos'; break;
    case 'juntar': tela = <Juntar />; aba = 'orcamentos'; break;
    case 'financeiro':
      aba = 'financeiro';
      tela = b === 'contas' ? <ContasFixas /> : b === 'ano' ? <FinanceiroAno ano={c} /> : <Financeiro mes={b === 'mes' ? c : undefined} />;
      break;
    case 'orcamento': tela = <OrcamentoTela id={b} />; aba = 'orcamentos'; barra = true; break;
    case 'bobinas': tela = b === 'precos' ? <PrecoKg /> : <Bobinas />; aba = 'mais'; break;
    case 'pedido': tela = <PedidoTela id={b} />; aba = 'mais'; break;
    case 'fornecedores': tela = <Fornecedores />; aba = 'mais'; break;
    case 'clientes': tela = <ClientesLista />; aba = 'mais'; break;
    case 'cliente':
      aba = 'mais';
      tela = b === 'novo' ? <ClienteForm /> : c === 'editar' ? <ClienteForm id={b} /> : <ClienteDetalhe id={b} />;
      break;
    case 'mais':
      aba = 'mais';
      tela = b === 'precos' ? <Precos /> : b === 'calheiros' ? <Calheiros /> : b === 'backup' ? <BackupTela /> : b === 'empresa' ? <Empresa /> : b === 'pin' ? <TrocarPin /> : b === 'nuvem' ? <Nuvem /> : b === 'avisos' ? <Avisos /> : <Mais onLock={onLock} />;
      break;
    default: tela = <Inicio />;
  }

  return (
    <>
      <main className={`app ${barra ? 'has-bar' : ''}`} key={r.join('/')}>{tela}</main>
      <div className="tabs"><nav aria-label="Seções">
        {[
          ['inicio', 'home', 'Início'],
          ['visitas', 'pin', 'Visitas'],
          ['orcamentos', 'doc', 'Orçamentos'],
          ['financeiro', 'cash', 'Financeiro'],
          ['mais', 'more', 'Mais'],
        ].map(([k, i, l]) => (
          <a key={k} href={`#/${k}`} aria-current={aba === k ? 'page' : undefined}>
            {k === 'visitas' && aMedir > 0 ? <span className="badge-dot" data-n={aMedir > 99 ? '99+' : aMedir}><Icon name={i} /></span> : <Icon name={i} />}{l}
          </a>
        ))}
      </nav></div>
    </>
  );
}
