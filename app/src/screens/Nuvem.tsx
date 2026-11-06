import { useState } from 'react';
import { useNuvem } from '../lib/hooks';
import { criarConta, entrar, sair, sincronizar } from '../lib/nuvem';
import { EMAIL_PADRAO } from '../lib/db';
import { go } from '../lib/router';
import { Confirm, Icon, Seg, TopBar, useToast } from '../components/ui';

const quando = (iso: string | null) => {
  if (!iso) return 'ainda não';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'agora há pouco' : min < 60 ? `há ${min} min` : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export function Nuvem() {
  const n = useNuvem();
  const toast = useToast();
  const [modo, setModo] = useState<'criar' | 'entrar'>('criar');
  const [email, setEmail] = useState(EMAIL_PADRAO);
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [sairConf, setSairConf] = useState(false);

  if (n.conectado) {
    return (
      <section className="stack">
        <TopBar onBack={() => go('mais')} backLabel="Mais" eyebrow="Cópia de segurança automática" title="Nuvem" />
        <div className="card hero">
          <div className="hrow">
            <div className={`ic ${n.erro ? 'warn' : 'ok'}`}><Icon name={n.erro ? 'alert' : 'check'} /></div>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{n.sincronizando ? 'Sincronizando…' : n.erro ? 'Atenção' : 'Tudo guardado na nuvem'}</div>
              <div className="small muted">{n.erro ?? `Última sincronização: ${quando(n.ultima)}`}</div>
            </div>
          </div>
        </div>
        <div className="card list">
          <div className="kv"><span className="k">Conta</span><span style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{n.email}</span></div>
          <div className="kv"><span className="k">Servidor</span><span>Supabase · São Paulo</span></div>
        </div>
        <button className="btn block primary" disabled={n.sincronizando} onClick={async () => { await sincronizar(); toast('Sincronizado'); }}><Icon name="upload" />Sincronizar agora</button>
        <p className="hint">Toda mudança vai para a nuvem sozinha, alguns segundos depois. Num celular novo, é só entrar com a mesma conta que tudo volta.</p>
        <button className="btn block ghost" onClick={() => setSairConf(true)}>Sair da conta neste celular</button>
        <Confirm open={sairConf} onClose={() => setSairConf(false)} title="Sair da conta?" text="Os dados continuam neste celular, mas param de ir para a nuvem até você entrar de novo." confirmLabel="Sair" onConfirm={async () => { await sair(); toast('Saiu da conta'); }} />
      </section>
    );
  }

  const enviar = async () => {
    setErro('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Confira o e-mail.');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    setOcupado(true);
    try {
      if (modo === 'criar') await criarConta(email, senha);
      else await entrar(email, senha);
      toast('Conectado à nuvem');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" eyebrow="Cópia de segurança automática" title="Nuvem" />
      <div className="card pad stack-s">
        <b>Guarde tudo na nuvem</b>
        <p className="muted small" style={{ margin: 0 }}>Com a conta ligada, cada orçamento, cliente, visita, lançamento e pedido vai sozinho para a nuvem. Se o celular quebrar ou for trocado, é só entrar com a mesma conta e tudo volta.</p>
      </div>
      <Seg label="Conta" value={modo} onChange={(m) => { setModo(m); setErro(''); }} options={[{ value: 'criar', label: 'Criar minha conta' }, { value: 'entrar', label: 'Já tenho conta' }]} />
      <div className="card form-card">
        <div className="field"><label htmlFor="nv-e">E-mail</label><input id="nv-e" className="input" type="email" inputMode="email" autoCapitalize="off" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field">
          <div className="hrow between"><label htmlFor="nv-s" className="label">{modo === 'criar' ? 'Crie uma senha' : 'Senha'}</label><button className="link small" onClick={() => setVer(!ver)}>{ver ? 'Esconder' : 'Mostrar'}</button></div>
          <input id="nv-s" className="input" type={ver ? 'text' : 'password'} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Pelo menos 8 caracteres" />
          {modo === 'criar' && <span className="hint">Guarde essa senha. Você vai usar só ao trocar de celular (no dia a dia continua o Face ID/PIN).</span>}
        </div>
        {erro && <span className="err">{erro}</span>}
        <button className="btn block primary" disabled={ocupado} onClick={enviar}><Icon name="check" />{ocupado ? 'Conectando…' : modo === 'criar' ? 'Criar conta e ligar a nuvem' : 'Entrar e ligar a nuvem'}</button>
      </div>
    </section>
  );
}
