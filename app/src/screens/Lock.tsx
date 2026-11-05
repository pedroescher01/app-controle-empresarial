import { useEffect, useState } from 'react';
import { Icon } from '../components/ui';
import { conferirPin, definirPin } from '../lib/pin';
import { pedirArmazenamentoPersistente } from '../lib/db';

const N = 6;

export function Lock({ criar, onOk }: { criar: boolean; onOk: () => void }) {
  const [etapa, setEtapa] = useState<'entrar' | 'criar' | 'confirmar'>(criar ? 'criar' : 'entrar');
  const [pin, setPin] = useState('');
  const [primeiro, setPrimeiro] = useState('');
  const [erro, setErro] = useState('');
  const [shake, setShake] = useState(false);

  const falha = (msg: string) => {
    setErro(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setPin(''); }, 380);
  };

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
        onOk();
      } else {
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
        <span />
        <button onClick={() => setPin((p) => (p.length < N ? p + '0' : p))}>0</button>
        <button className="txt" aria-label="Apagar" onClick={() => setPin((p) => p.slice(0, -1))}><Icon name="del" /></button>
      </div>
    </main>
  );
}
