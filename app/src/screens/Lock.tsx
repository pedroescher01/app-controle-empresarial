import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/ui';
import { conferirPin, definirPin } from '../lib/pin';
import { pedirArmazenamentoPersistente } from '../lib/db';
import { ativarFaceId, entrarComFaceId, faceIdAtivo, faceIdDisponivel, idFaceId } from '../lib/faceid';

const N = 6;

export function Lock({ criar, onOk, oferecerFaceId = true }: { criar: boolean; onOk: () => void; oferecerFaceId?: boolean }) {
  const [etapa, setEtapa] = useState<'entrar' | 'criar' | 'confirmar' | 'faceid'>(criar ? 'criar' : 'entrar');
  const [pin, setPin] = useState('');
  const [primeiro, setPrimeiro] = useState('');
  const [erro, setErro] = useState('');
  const [shake, setShake] = useState(false);
  const [faceId, setFaceId] = useState<string | null>(null);
  const [usarPin, setUsarPin] = useState(false);
  const pedindo = useRef(false);

  const falha = (msg: string) => {
    setErro(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setPin(''); }, 380);
  };

  // chamado direto no toque: assim o iPhone abre o Face ID sem a janela de confirmação
  const pedirFace = () => {
    if (!faceId || pedindo.current) return;
    pedindo.current = true;
    entrarComFaceId(faceId)
      .then((ok) => (ok ? onOk() : setErro('Não reconheceu. Toque de novo ou use o PIN.')))
      .catch(() => setErro('Face ID cancelado. Toque de novo ou use o PIN.'))
      .finally(() => (pedindo.current = false));
  };

  useEffect(() => {
    if (etapa === 'entrar') idFaceId().then(setFaceId);
  }, [etapa]);

  useEffect(() => {
    if (pin.length !== N) return;
    (async () => {
      if (etapa === 'criar') {
        setPrimeiro(pin);
        setPin('');
        setErro('');
        setEtapa('confirmar');
      } else if (etapa === 'confirmar') {
        if (pin !== primeiro) {
          setEtapa('criar');
          setPrimeiro('');
          falha('Os PINs não bateram. Comece de novo.');
          return;
        }
        await definirPin(pin);
        await pedirArmazenamentoPersistente();
        if (oferecerFaceId && (await faceIdDisponivel()) && !(await faceIdAtivo())) setEtapa('faceid');
        else onOk();
      } else if (etapa === 'entrar') {
        if (await conferirPin(pin)) onOk();
        else falha('PIN errado. Tente de novo.');
      }
    })();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < N ? p + e.key : p));
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (etapa === 'faceid') {
    return (
      <main className="lock">
        <div className="mark"><Icon name="face" style={{ width: 34, height: 34 }} /></div>
        <div>
          <h1>Entrar com Face ID?</h1>
          <p>Fica mais rápido: é só olhar para o celular. O PIN continua valendo se o Face ID falhar.</p>
        </div>
        <div className="stack-s" style={{ width: '100%' }}>
          <button className="btn block primary" onClick={async () => {
            try { await ativarFaceId(); } catch { /* recusou: segue só com PIN */ }
            onOk();
          }}><Icon name="face" />Ativar Face ID</button>
          <button className="btn block ghost" onClick={onOk}>Agora não</button>
        </div>
      </main>
    );
  }

  if (etapa === 'entrar' && faceId && !usarPin) {
    return (
      <main className="lock tap" onClick={pedirFace} role="button" aria-label="Toque para entrar com Face ID">
        <div className="mark">CA</div>
        <div>
          <h1>Toque para entrar</h1>
          <p>{erro ? <span className="err">{erro}</span> : 'Em qualquer lugar da tela, com Face ID'}</p>
        </div>
        <div className="face-ring"><Icon name="face" /></div>
        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); setErro(''); setUsarPin(true); }}>Usar PIN</button>
      </main>
    );
  }

  const titulo = etapa === 'entrar' ? 'Digite seu PIN' : etapa === 'criar' ? 'Crie um PIN de 6 números' : 'Digite o PIN de novo';
  const sub = etapa === 'entrar' ? 'Calhas Andrade' : etapa === 'criar' ? 'Ele vai proteger os dados da empresa neste celular.' : 'Só para confirmar.';

  return (
    <main className="lock">
      <div className="mark">CA</div>
      <div>
        <h1>{titulo}</h1>
        <p>{erro ? <span className="err">{erro}</span> : sub}</p>
      </div>
      <div className={`dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length} de ${N} números`}>
        {Array.from({ length: N }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => setPin((p) => (p.length < N ? p + d : p))}>{d}</button>
        ))}
        {etapa === 'entrar' && faceId
          ? <button className="txt" aria-label="Entrar com Face ID" onClick={pedirFace}><Icon name="face" /></button>
          : <span />}
        <button onClick={() => setPin((p) => (p.length < N ? p + '0' : p))}>0</button>
        <button className="txt" aria-label="Apagar" onClick={() => setPin((p) => p.slice(0, -1))}><Icon name="del" /></button>
      </div>
    </main>
  );
}
