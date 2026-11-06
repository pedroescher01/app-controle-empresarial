import { useEffect, useRef, useState } from 'react';
import { setConfig } from '../lib/db';
import { useAdiantamentos, useCalheiros, useConfig, useNuvem } from '../lib/hooks';
import { plural, saldos } from '../lib/adiantamento';
import { CATALOGO, precoCatalogo } from '../lib/catalog';
import { brl, fmtData, haDias } from '../lib/format';
import { go } from '../lib/router';
import { gerarBackup, lerBackup, marcarBackupFeito, restaurarBackup, contarBackup, type Backup } from '../lib/backup';
import { compartilharArquivo } from '../lib/share';
import { Confirm, Empty, Icon, MoneyInput, Seg, TopBar, useToast } from '../components/ui';
import { CalheiroRapido } from './Orcamento';
import { Lock } from './Lock';
import { VERSAO_ATUAL } from '../lib/atualizar';
import { ativarFaceId, desativarFaceId, faceIdDisponivel } from '../lib/faceid';

export function Mais({ onLock }: { onLock: () => void }) {
  const cfg = useConfig();
  const calheiros = useCalheiros();
  const nuvem = useNuvem();
  return (
    <section className="stack">
      <TopBar eyebrow="Ajustes do sistema" title="Mais" />
      <div className="card list">
        <a className="row" href="#/bobinas"><div className="ic info"><Icon name="coil" /></div><div className="main"><div className="t">Bobinas e pedidos</div><div className="s">Estoque, pedido ao fornecedor, preço do kg</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/clientes"><div className="ic red"><Icon name="users" /></div><div className="main"><div className="t">Clientes</div><div className="s">Cadastro, histórico e contato</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/financeiro/contas"><div className="ic warn"><Icon name="clock" /></div><div className="main"><div className="t">Contas fixas e maquininha</div><div className="s">Aluguel, DAS, retirada, taxas do cartão</div></div><Icon name="chev" className="chev" /></a>
      </div>
      <div className="card list">
        <a className="row" href="#/mais/precos"><div className="ic red"><Icon name="tag" /></div><div className="main"><div className="t">Tabela de preços</div><div className="s">Metro a {brl(cfg.precoMetro)} · chapa 24 +{Math.round((cfg.fatorChapa24 - 1) * 100)}%</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/calheiros"><div className="ic info"><Icon name="helmet" /></div><div className="main"><div className="t">Calheiros</div><div className="s">{calheiros.length ? calheiros.map((c) => c.nome).join(', ') : 'Nenhum cadastrado'}</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/nuvem"><div className={`ic ${nuvem.conectado ? (nuvem.erro ? 'warn' : 'ok') : 'red'}`}><Icon name="upload" /></div><div className="main"><div className="t">Nuvem</div><div className="s">{nuvem.conectado ? (nuvem.erro ? nuvem.erro : `Ligada · ${nuvem.email}`) : 'Desligada · toque para ligar'}</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/avisos"><div className="ic warn"><Icon name="bell" /></div><div className="main"><div className="t">Avisos no celular</div><div className="s">Resumo às 7h30 e às 18h30</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/backup"><div className="ic ok"><Icon name="hard" /></div><div className="main"><div className="t">Backup dos dados</div><div className="s">{cfg.ultimoBackup ? `Último ${haDias(cfg.ultimoBackup)}` : 'Nunca feito'}</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/empresa"><div className="ic mute"><Icon name="building" /></div><div className="main"><div className="t">Dados no PDF</div><div className="s">{cfg.email ? cfg.email : 'E-mail em branco'} · validade {cfg.validadeDias} dias</div></div><Icon name="chev" className="chev" /></a>
      </div>

      <div className="card form-card">
        <h3>Aparência</h3>
        <Seg label="Tema" value={cfg.tema} onChange={(tema) => setConfig({ tema })} options={[{ value: 'auto', label: 'Automático' }, { value: 'claro', label: 'Claro' }, { value: 'escuro', label: 'Escuro' }]} />
      </div>

      <div className="card list">
        <FaceIdLinha ativo={!!cfg.faceIdCred} />
        <a className="row" href="#/mais/pin"><div className="ic mute"><Icon name="lock" /></div><div className="main"><div className="t">Trocar PIN</div></div><Icon name="chev" className="chev" /></a>
        <button className="row" onClick={onLock}><div className="ic mute"><Icon name="lock" /></div><div className="main"><div className="t">Bloquear agora</div></div></button>
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>{nuvem.conectado ? 'Os dados ficam neste iPhone e com cópia automática na nuvem.' : 'Os dados ficam guardados neste iPhone. Ligue a nuvem ou faça backup toda semana.'}<br />Versão de {VERSAO_ATUAL ? new Date(VERSAO_ATUAL).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</p>
    </section>
  );
}

// ---------- preços ----------
export function Precos() {
  const cfg = useConfig();
  const setPreco = (k: string, v: number) => setConfig({ precos: { ...cfg.precos, [k]: v } });
  const grupos = ['Condutores', 'Acessórios'] as const;
  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" title="Tabela de preços" />
      <div className="card form-card">
        <h3>Calhas, rufos e chapa</h3>
        <div className="field"><label htmlFor="pm">Preço do metro (corte de 1 m, chapa 26)</label><MoneyInput id="pm" value={cfg.precoMetro} onChange={(v) => setConfig({ precoMetro: v ?? 0 })} /><span className="hint">Ex.: corte 33 = 0,33 × {brl(cfg.precoMetro)} = {brl(0.33 * cfg.precoMetro)} o metro.</span></div>
        <div className="field"><label htmlFor="f24">Chapa 24 mais cara em</label>
          <select id="f24" className="input" value={Math.round((cfg.fatorChapa24 - 1) * 100)} onChange={(e) => setConfig({ fatorChapa24: 1 + Number(e.target.value) / 100 })}>
            {[20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 100].map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
        </div>
      </div>
      {grupos.map((g) => (
        <div key={g} className="card list">
          <div className="kv"><b style={{ fontFamily: 'var(--f-display)' }}>{g}</b></div>
          {CATALOGO.filter((c) => c.grupo === g).map((c) => (
            <div key={c.key} className="kv" style={{ alignItems: 'center' }}>
              <label className="k" htmlFor={`pr-${c.key}`}>{c.descricao} <span className="faint">/ {c.unidade}</span></label>
              <MoneyInput id={`pr-${c.key}`} value={precoCatalogo(c, cfg.precos)} onChange={(v) => setPreco(c.key, v ?? 0)} style={{ width: 130, textAlign: 'right', minHeight: 40, padding: '8px 10px' }} />
            </div>
          ))}
        </div>
      ))}
      <p className="hint">Mudanças valem para os próximos itens adicionados. Itens já lançados mantêm o preço deles.</p>
    </section>
  );
}

// ---------- calheiros ----------
export function Calheiros() {
  const calheiros = useCalheiros();
  const movs = useAdiantamentos();
  const [novo, setNovo] = useState(false);
  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" title="Calheiros" right={<button className="icon-btn red" aria-label="Novo calheiro" onClick={() => setNovo(true)}><Icon name="plus" /></button>} />
      {!calheiros.length ? (
        <Empty icon="helmet" title="Nenhum calheiro" text="Cadastre o Dalvo, o Miguel e os outros. Eles aparecem no orçamento entre parênteses." action={<button className="btn primary" onClick={() => setNovo(true)}><Icon name="plus" />Cadastrar</button>} />
      ) : (
        <div className="card list">
          {calheiros.map((c) => {
            const sal = saldos(movs, c.id);
            return (
              <a key={c.id} className="row" href={`#/calheiro/${c.id}`}>
                <div className="ic info"><Icon name="helmet" /></div>
                <div className="main"><div className="t">{c.nome}</div><div className="s">{[c.telefone || 'Sem telefone', !c.ativo ? 'inativo' : '', sal.length ? `com ele: ${sal.map((x) => plural(x.saldo, x.descricao)).join(', ')}` : ''].filter(Boolean).join(' · ')}</div></div>
                <Icon name="chev" className="chev" />
              </a>
            );
          })}
        </div>
      )}
      <CalheiroRapido open={novo} onClose={() => setNovo(false)} />
    </section>
  );
}

// ---------- empresa ----------
export function Empresa() {
  const cfg = useConfig();
  const [email, setEmail] = useState(cfg.email);
  const toast = useToast();
  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" title="Dados no PDF" />
      <div className="card list">
        <div className="kv"><span className="k">Empresa</span><span>Calhas Andrade</span></div>
        <div className="kv"><span className="k">CNPJ</span><span className="num">16.693.515/0001-54</span></div>
        <div className="kv"><span className="k">Endereço</span><span style={{ textAlign: 'right' }}>Rua 13 de maio, 874 - Centro - Araras/SP</span></div>
        <div className="kv"><span className="k">Telefones</span><span className="num" style={{ textAlign: 'right' }}>(19) 98959-0119<br />(19) 99783-7079</span></div>
      </div>
      <div className="card form-card">
        <div className="field"><label htmlFor="em">E-mail no cabeçalho</label><input id="em" className="input" type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { setConfig({ email: email.trim() }); }} placeholder="calhasandradeararas@gmail.com" /></div>
        <div className="field"><label htmlFor="vd">Validade padrão do orçamento</label>
          <select id="vd" className="input" value={cfg.validadeDias} onChange={(e) => { setConfig({ validadeDias: Number(e.target.value) }); toast('Validade alterada'); }}>
            {[7, 10, 15, 20, 30, 45, 60].map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </div>
      </div>
    </section>
  );
}

// ---------- backup ----------
export function BackupTela() {
  const cfg = useConfig();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [lido, setLido] = useState<Backup | null>(null);
  const [erro, setErro] = useState('');
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" title="Backup" eyebrow={cfg.ultimoBackup ? `Último em ${fmtData(cfg.ultimoBackup.slice(0, 10))}` : 'Nenhum backup ainda'} />
      <div className="card pad stack-s">
        <b>Como funciona</b>
        <p className="muted small" style={{ margin: 0 }}>Os dados ficam só neste iPhone. O backup é um arquivo com tudo: clientes, orçamentos, pagamentos e preços. Salve no iCloud Drive ou mande para o seu próprio WhatsApp. Faça pelo menos uma vez por semana.</p>
      </div>

      {!file ? (
        <button className="btn block primary" onClick={async () => { setFile(await gerarBackup()); }}><Icon name="download" />Preparar backup</button>
      ) : (
        <div className="card pad stack-s">
          <div className="small muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
          <button className="btn block primary" onClick={async () => {
            const r = await compartilharArquivo(file);
            if (r !== 'cancelado') { await marcarBackupFeito(); toast('Backup feito'); setFile(null); }
          }}><Icon name="share" />Salvar ou enviar o arquivo</button>
        </div>
      )}

      <div className="h2"><h2>Restaurar</h2></div>
      <div className="card pad stack-s">
        <p className="muted small" style={{ margin: 0 }}>Use em um celular novo ou se os dados sumirem. <b>Tudo que está no app agora é trocado pelo conteúdo do backup.</b></p>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { setErro(''); setLido(await lerBackup(f)); } catch (err) { setErro((err as Error).message); }
        }} />
        <button className="btn block" onClick={() => input.current?.click()}><Icon name="upload" />Escolher arquivo de backup</button>
        {erro && <span className="err">{erro}</span>}
      </div>
      <Confirm open={!!lido} onClose={() => setLido(null)} title="Restaurar este backup?"
        text={lido ? `Backup de ${fmtData(lido.exportadoEm.slice(0, 10))}: ${contarBackup(lido).clientes} clientes, ${contarBackup(lido).orcamentos} orçamentos, ${contarBackup(lido).calheiros} calheiros. Os dados atuais serão substituídos.` : ''}
        confirmLabel="Restaurar" danger onConfirm={async () => { if (lido) { await restaurarBackup(lido); toast('Backup restaurado'); go('inicio'); } }} />
    </section>
  );
}

export function TrocarPin() {
  const toast = useToast();
  return <Lock criar oferecerFaceId={false} onOk={() => { toast('PIN trocado'); go('mais'); }} />;
}

function FaceIdLinha({ ativo }: { ativo: boolean }) {
  const toast = useToast();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { faceIdDisponivel().then(setOk); }, []);
  if (ok === false) return (
    <div className="row"><div className="ic mute"><Icon name="face" /></div><div className="main"><div className="t">Face ID</div><div className="s">Abra pelo ícone da tela de início do iPhone para usar</div></div></div>
  );
  return (
    <button className="row" onClick={async () => {
      if (ativo) { await desativarFaceId(); toast('Face ID desligado'); return; }
      try { await ativarFaceId(); toast('Face ID ativado'); } catch { toast('O Face ID não foi ativado'); }
    }}>
      <div className={`ic ${ativo ? 'ok' : 'mute'}`}><Icon name="face" /></div>
      <div className="main"><div className="t">Entrar com Face ID</div><div className="s">{ativo ? 'Ligado · o PIN fica de reserva' : 'Desligado'}</div></div>
      <span className={`pill ${ativo ? 'ok' : 'mute'}`}>{ativo ? 'Ligado' : 'Ligar'}</span>
    </button>
  );
}
