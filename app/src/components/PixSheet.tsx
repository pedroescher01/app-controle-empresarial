import { useMemo, useState } from 'react';
import { useConfig } from '../lib/hooks';
import { pixCopiaECola, qrSvg } from '../lib/pix';
import { brl, waLink } from '../lib/format';
import { go } from '../lib/router';
import { Icon, MoneyInput, Sheet, useToast } from './ui';

/** Cobrança no Pix: QR Code na tela + copia e cola + mandar no WhatsApp. */
export function PixSheet({ valorInicial, onClose, telefone, nomeCliente, referencia, mensagem }: {
  valorInicial: number; onClose: () => void; telefone?: string; nomeCliente?: string; referencia?: string; mensagem?: string;
}) {
  const cfg = useConfig();
  const toast = useToast();
  const [valor, setValor] = useState<number | null>(valorInicial || null);
  const pronto = !!cfg.pixChave && !!cfg.pixNome;
  const codigo = useMemo(() => (pronto && valor && valor > 0 ? pixCopiaECola({ chave: cfg.pixChave, nome: cfg.pixNome, cidade: cfg.pixCidade || 'Araras', valor, txid: referencia }) : ''), [pronto, valor, cfg.pixChave, cfg.pixNome, cfg.pixCidade, referencia]);
  const svg = useMemo(() => (codigo ? qrSvg(codigo) : ''), [codigo]);

  if (!pronto) {
    return (
      <Sheet open onClose={onClose} title="Cobrar no Pix">
        <p className="muted" style={{ margin: 0 }}>Falta cadastrar a chave Pix e o nome de quem recebe.</p>
        <button className="btn block primary" onClick={() => { onClose(); go('mais/empresa'); }}>Cadastrar a chave Pix</button>
      </Sheet>
    );
  }
  const primeiro = nomeCliente ? nomeCliente.split(' ')[0] : '';
  const texto = `${primeiro ? `Olá, ${primeiro}! ` : ''}${mensagem ?? 'Segue o Pix'} no valor de ${brl(valor ?? 0)}.\nÉ só copiar o código abaixo e colar no app do banco, em "Pix Copia e Cola":\n\n${codigo}\n\nCalhas Andrade`;
  return (
    <Sheet open onClose={onClose} title="Cobrar no Pix">
      <div className="field"><label htmlFor="pix-v">Valor</label><MoneyInput id="pix-v" value={valor} onChange={setValor} allowEmpty /></div>
      {codigo ? (
        <>
          <div className="pix-qr" aria-label={`QR Code do Pix de ${brl(valor ?? 0)}`} dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>{brl(valor ?? 0)} para {cfg.pixNome}. O cliente lê com a câmera do app do banco.</p>
          <div className="pix-code num">{codigo}</div>
          <div className="btns">
            <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(codigo); toast('Código Pix copiado'); } catch { toast('Não deu para copiar'); } }}><Icon name="copy" />Copiar</button>
            {telefone
              ? <a className="btn primary" href={waLink(telefone, texto)} target="_blank" rel="noreferrer"><Icon name="wa" />WhatsApp</a>
              : <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><Icon name="wa" />WhatsApp</a>}
          </div>
          <p className="hint" style={{ margin: 0 }}>O sistema não fica sabendo sozinho do pagamento: quando cair, registre o pagamento normalmente.</p>
        </>
      ) : <p className="hint" style={{ margin: 0 }}>Digite o valor.</p>}
    </Sheet>
  );
}
