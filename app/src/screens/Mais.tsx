import { useRef, useState } from 'react';
import { db, setConfig, type Calheiro } from '../lib/db';
import { useCalheiros, useConfig } from '../lib/hooks';
import { CATALOGO, precoCatalogo } from '../lib/catalog';
import { brl, fmtData, haDias, maskPhone, waLink } from '../lib/format';
import { go } from '../lib/router';
import { gerarBackup, lerBackup, marcarBackupFeito, restaurarBackup, contarBackup, type Backup } from '../lib/backup';
import { compartilharArquivo } from '../lib/share';
import { Confirm, Empty, Icon, MoneyInput, PhoneInput, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { CalheiroRapido } from './Orcamento';
import { Lock } from './Lock';

export function Mais({ onLock }: { onLock: () => void }) {
  const cfg = useConfig();
  const calheiros = useCalheiros();
  return (
    <section className="stack">
      <TopBar eyebrow="Ajustes do sistema" title="Mais" />
      <div className="card list">
        <a className="row" href="#/mais/precos"><div className="ic red"><Icon name="tag" /></div><div className="main"><div className="t">Tabela de preços</div><div className="s">Metro a {brl(cfg.precoMetro)} · chapa 24 +{Math.round((cfg.fatorChapa24 - 1) * 100)}%</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/calheiros"><div className="ic info"><Icon name="helmet" /></div><div className="main"><div className="t">Calheiros</div><div className="s">{calheiros.length ? calheiros.map((c) => c.nome).join(', ') : 'Nenhum cadastrado'}</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/backup"><div className="ic ok"><Icon name="hard" /></div><div className="main"><div className="t">Backup dos dados</div><div className="s">{cfg.ultimoBackup ? `Último ${haDias(cfg.ultimoBackup)}` : 'Nunca feito'}</div></div><Icon name="chev" className="chev" /></a>
        <a className="row" href="#/mais/empresa"><div className="ic mute"><Icon name="building" /></div><div className="main"><div className="t">Dados no PDF</div><div className="s">{cfg.email ? cfg.email : 'E-mail em branco'} · validade {cfg.validadeDias} dias</div></div><Icon name="chev" className="chev" /></a>
      </div>

      <div className="card form-card">
        <h3>Aparência</h3>
        <Seg label="Tema" value={cfg.tema} onChange={(tema) => setConfig({ tema })} options={[{ value: 'auto', label: 'Automático' }, { value: 'claro', label: 'Claro' }, { value: 'escuro', label: 'Escuro' }]} />
      </div>

      <div className="card list">
        <a className="row" href="#/mais/pin"><div className="ic mute"><Icon name="lock" /></div><div className="main"><div className="t">Trocar PIN</div></div><Icon name="chev" className="chev" /></a>
        <button className="row" onClick={onLock}><div className="ic mute"><Icon name="lock" /></div><div className="main"><div className="t">Bloquear agora</div></div></button>
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>Os dados ficam guardados neste iPhone. Faça backup toda semana.</p>
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
  const [novo, setNovo] = useState(false);
  const [edit, setEdit] = useState<Calheiro | null>(null);
  return (
    <section className="stack">
      <TopBar onBack={() => go('mais')} backLabel="Mais" title="Calheiros" right={<button className="icon-btn red" aria-label="Novo calheiro" onClick={() => setNovo(true)}><Icon name="plus" /></button>} />
      {!calheiros.length ? (
        <Empty icon="helmet" title="Nenhum calheiro" text="Cadastre o Dalvo, o Miguel e os outros. Eles aparecem no orçamento entre parênteses." action={<button className="btn primary" onClick={() => setNovo(true)}><Icon name="plus" />Cadastrar</button>} />
      ) : (
        <div className="card list">
          {calheiros.map((c) => (
            <button key={c.id} className="row" onClick={() => setEdit(c)}>
              <div className="ic info"><Icon name="helmet" /></div>
              <div className="main"><div className="t">{c.nome}</div><div className="s">{c.telefone || 'Sem telefone'}{!c.ativo && ' · inativo'}</div></div>
              <Icon name="chev" className="chev" />
            </button>
          ))}
        </div>
      )}
      <CalheiroRapido open={novo} onClose={() => setNovo(false)} />
      {edit && <CalheiroEdit c={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function CalheiroEdit({ c, onClose }: { c: Calheiro; onClose: () => void }) {
  const [nome, setNome] = useState(c.nome);
  const [tel, setTel] = useState(maskPhone(c.telefone));
  const [ativo, setAtivo] = useState(c.ativo);
  const [apagar, setApagar] = useState(false);
  const toast = useToast();
  return (
    <Sheet open onClose={onClose} title="Calheiro">
      <div className="field"><label htmlFor="ce-n">Nome</label><input id="ce-n" className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="field"><label htmlFor="ce-t">Telefone</label><PhoneInput id="ce-t" value={tel} onChange={setTel} /></div>
      <Seg label="Situação" value={ativo ? 's' : 'n'} onChange={(v) => setAtivo(v === 's')} options={[{ value: 's', label: 'Ativo' }, { value: 'n', label: 'Inativo' }]} />
      {tel && <a className="btn block" href={waLink(tel)} target="_blank" rel="noreferrer"><Icon name="wa" />WhatsApp</a>}
      <button className="btn block primary" disabled={!nome.trim()} onClick={async () => { await db.calheiros.update(c.id, { nome: nome.trim(), telefone: tel, ativo }); onClose(); }}><Icon name="check" />Salvar</button>
      <button className="btn block danger" onClick={() => setApagar(true)}><Icon name="trash" />Apagar</button>
      <Confirm open={apagar} onClose={() => setApagar(false)} title={`Apagar ${c.nome}?`} text="Nos orçamentos antigos o nome dele deixa de aparecer. Se ele só parou de trabalhar com vocês, prefira marcar como inativo." confirmLabel="Apagar" danger onConfirm={async () => { await db.calheiros.delete(c.id); toast('Calheiro apagado'); onClose(); }} />
    </Sheet>
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
  return <Lock criar onOk={() => { toast('PIN trocado'); go('mais'); }} />;
}
