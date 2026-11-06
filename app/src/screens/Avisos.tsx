import { useEffect, useState } from 'react';
import { useNuvem } from '../lib/hooks';
import { ativarAvisos, avisoDeTeste, desativarAvisos, inscricaoAtual, instaladoNaTela, lerPrefs, pedirPermissao, salvarPrefs, suportaAvisos, type Prefs } from '../lib/avisos';
import { go } from '../lib/router';
import { Icon, TopBar, useToast } from '../components/ui';

function Requisito({ ok, titulo, sub, acao }: { ok: boolean; titulo: string; sub: string; acao?: React.ReactNode }) {
  return (
    <div className="row">
      <div className={`ic ${ok ? 'ok' : 'mute'}`}><Icon name={ok ? 'check' : 'alert'} /></div>
      <div className="main"><div className="t" style={{ whiteSpace: 'normal' }}>{titulo}</div><div className="s" style={{ whiteSpace: 'normal' }}>{sub}</div></div>
      {!ok && acao}
    </div>
  );
}

function Opcao({ on, titulo, sub, onChange }: { on: boolean; titulo: string; sub: string; onChange: (v: boolean) => void }) {
  return (
    <button className="row" onClick={() => onChange(!on)} aria-pressed={on}>
      <div className="main"><div className="t">{titulo}</div><div className="s" style={{ whiteSpace: 'normal' }}>{sub}</div></div>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  );
}

export function Avisos() {
  const nuvem = useNuvem();
  const toast = useToast();
  const instalado = instaladoNaTela();
  const suporta = suportaAvisos();
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ manha: true, noite: true });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const negado = suporta && Notification.permission === 'denied';

  useEffect(() => {
    inscricaoAtual().then((s) => setAtivo(!!s && Notification.permission === 'granted'));
    lerPrefs().then((p) => p && setPrefs(p));
  }, [nuvem.conectado]);

  const ligar = () => {
    setErro('');
    // o pedido de permissão tem que sair direto do toque
    pedirPermissao().then(async (perm) => {
      if (perm !== 'granted') { setErro('Sem permissão. Em Ajustes do iPhone → Notificações → Calhas Andrade, ligue “Permitir notificações”.'); return; }
      setOcupado(true);
      try { await ativarAvisos(prefs); setAtivo(true); toast('Avisos ligados'); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
    });
  };
  const mudar = async (p: Prefs) => { setPrefs(p); await salvarPrefs(p); };

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" eyebrow="Notificações no celular" title="Avisos" />
      <div className="card pad stack-s">
        <b>O que você recebe</b>
        <p className="muted small" style={{ margin: 0 }}>
          <b>7h30</b>: o que medir e instalar hoje, contas que vencem ou estão atrasadas, visitas esperando e orçamentos sem resposta.<br />
          <b>18h30</b>: o que tem amanhã (visitas, serviços e contas).<br />Se não tiver nada, não manda nada.
        </p>
      </div>

      <div className="card list">
        <Requisito ok={instalado} titulo="App aberto pelo ícone da tela de início" sub={instalado ? 'Certo.' : 'No Safari: Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone.'} />
        <Requisito ok={nuvem.conectado} titulo="Nuvem ligada" sub={nuvem.conectado ? nuvem.email ?? '' : 'Os avisos usam os dados da nuvem.'} acao={<button className="btn" onClick={() => go('mais/nuvem')}>Ligar</button>} />
        <Requisito ok={!!ativo} titulo="Avisos ligados neste celular" sub={ativo ? 'Pronto.' : negado ? 'Bloqueado nos Ajustes do iPhone.' : 'Toque em “Ligar avisos” abaixo.'} />
      </div>

      {ativo ? (
        <>
          <div className="card list">
            <Opcao on={prefs.manha} titulo="Resumo da manhã (7h30)" sub="O que tem hoje" onChange={(v) => mudar({ ...prefs, manha: v })} />
            <Opcao on={prefs.noite} titulo="Aviso da noite (18h30)" sub="O que tem amanhã" onChange={(v) => mudar({ ...prefs, noite: v })} />
          </div>
          <button className="btn block primary" disabled={ocupado} onClick={async () => { setOcupado(true); try { const r = await avisoDeTeste(); if (r.includes('ok')) toast('Aviso de teste enviado. Deve chegar em alguns segundos.'); else { setAtivo(false); setErro('O aviso não chegou neste celular. Toque em “Ligar avisos” de novo.'); } } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); } }}><Icon name="check" />Mandar aviso de teste</button>
          <button className="btn block ghost" onClick={async () => { await desativarAvisos(); setAtivo(false); toast('Avisos desligados neste celular'); }}>Desligar avisos</button>
        </>
      ) : (
        <button className="btn block primary" disabled={!instalado || !nuvem.conectado || !suporta || ocupado || negado} onClick={ligar}><Icon name="clock" />{ocupado ? 'Ligando…' : 'Ligar avisos'}</button>
      )}
      {erro && <span className="err">{erro}</span>}
      {!suporta && instalado && <p className="hint">Este iPhone precisa do iOS 16.4 ou mais novo para receber avisos.</p>}
    </section>
  );
}
