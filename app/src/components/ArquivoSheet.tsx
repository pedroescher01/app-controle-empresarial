import { useEffect, useState } from 'react';
import { Icon, Sheet, useToast } from './ui';
import { compartilharArquivo } from '../lib/share';

/** Prévia de um PDF gerado na hora + botão de compartilhar (o compartilhar precisa do toque, por isso é em 2 passos). */
export function ArquivoSheet({ titulo, gerar, onClose, onEnviado }: { titulo: string; gerar: () => Promise<File>; onClose: () => void; onEnviado?: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    gerar()
      .then((f) => { if (vivo) { setFile(f); setUrl(URL.createObjectURL(f)); } })
      .catch(() => vivo && setErro('Não consegui montar o PDF. Confira a internet e tente de novo.'));
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <Sheet open onClose={onClose} title={titulo}>
      {erro ? <p className="err">{erro}</p> : !file ? <p className="muted">Montando o PDF…</p> : (
        <>
          <div className="card" style={{ overflow: 'hidden', aspectRatio: '419 / 595', maxWidth: '100%', background: '#fff' }}>
            <iframe title="Prévia do PDF" src={url + '#toolbar=0&view=FitH'} style={{ width: '100%', height: '100%', border: 0 }} />
          </div>
          <div className="small muted" style={{ wordBreak: 'break-word' }}>{file.name}</div>
          <button className="btn block primary" onClick={async () => {
            const r = await compartilharArquivo(file);
            if (r !== 'cancelado') { onEnviado?.(); toast(r === 'ok' ? 'PDF enviado' : 'PDF baixado'); onClose(); }
          }}><Icon name="share" />Salvar ou enviar</button>
          <a className="btn block" href={url} target="_blank" rel="noreferrer"><Icon name="doc" />Abrir em tela cheia</a>
        </>
      )}
    </Sheet>
  );
}
