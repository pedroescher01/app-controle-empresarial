import { useMemo } from 'react';
import { useNuvem, useBobinas, useConfig, useContasFixas, useLancamentos, useOrcamentos, usePedidos, useVisitas } from '../lib/hooks';
import { contasProximas } from '../lib/financeiro';
import { bobinasParaComprar, listaPrioridade, statusPedido } from '../lib/bobinas';
import { calcular, resumoPagamentos, statusVisual } from '../lib/calc';
import { brl, dataExtenso, diasEntre, fmtData, haDias, hojeISO, nomeMes, waLink } from '../lib/format';
import { go } from '../lib/router';
import { Icon, Pill } from '../components/ui';
import { novoOrcamento } from './Orcamentos';
import { quando } from './Visitas';

export function Inicio() {
  const cfg = useConfig();
  const orcs = useOrcamentos();
  const hoje = hojeISO();
  const mesISO = hoje.slice(0, 7);
  const visitas = useVisitas().filter((v) => v.status === 'a_medir');
  const servicosHoje = orcs.filter((o) => o.servicoData === hoje && o.status !== 'recusado');
  const maisAntiga = visitas.reduce<string | null>((m, v) => (!m || v.criadoEm < m ? v.criadoEm : m), null);
  const visitasHoje = visitas.filter((v) => v.data === hoje);
  const lancamentos = useLancamentos();
  const pedidos = usePedidos();
  const bobinasTodas = useBobinas();
  const paraComprar = bobinasParaComprar(bobinasTodas, pedidos);
  const prio = listaPrioridade(bobinasTodas, pedidos);
  const pedidosAtencao = pedidos.filter((p) => p.chegouEm && !p.pagoEm);
  const contasVencendo = contasProximas(useContasFixas(), lancamentos, 3);
  const recebidoMes = lancamentos.filter((l) => l.tipo === 'entrada' && l.data.startsWith(mesISO)).reduce((s, l) => s + l.valor, 0);

  const d = useMemo(() => {
    const ls = orcs.map((o) => {
      const r = calcular(o, cfg);
      return { o, total: r.total, st: statusVisual(o, r.total), pg: resumoPagamentos(o, r.total) };
    });
    const vivos = ls.filter((l) => !l.o.juntadoNo);
    const aReceber = vivos.filter((l) => (l.o.status === 'aprovado' || l.o.pagamentos.length) && l.pg.saldo > 0);
    const semResposta = vivos.filter((l) => l.o.status === 'enviado' && !l.o.pagamentos.length && diasEntre(l.o.enviadoEm ?? l.o.emitidoEm, hoje) >= 5);
    const rascunhos = vivos.filter((l) => l.o.status === 'rascunho');
    const orcadoMes = vivos.filter((l) => l.o.emitidoEm.startsWith(mesISO) && l.o.status !== 'rascunho').reduce((s, l) => s + l.total, 0);
    return { ls, aReceber, semResposta, rascunhos, orcadoMes, totalReceber: aReceber.reduce((s, l) => s + l.pg.saldo, 0) };
  }, [orcs, cfg, hoje, mesISO]);

  const diasBackup = cfg.ultimoBackup ? diasEntre(cfg.ultimoBackup.slice(0, 10), hoje) : null;
  const nuvem = useNuvem();
  const precisaBackup = !nuvem.conectado && orcs.length > 0 && (diasBackup == null || diasBackup >= 7);
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const mes = nomeMes(new Date().getMonth());

  const atencao = !nuvem.conectado || precisaBackup || d.semResposta.length > 0 || d.rascunhos.length > 0 || visitas.length > 0 || contasVencendo.length > 0 || paraComprar.length > 0 || pedidosAtencao.length > 0;
  const agendaHoje = visitasHoje.length + servicosHoje.length;

  return (
    <section className="stack">
      <header className="top"><div className="titles"><p className="eyebrow">{dataExtenso()}</p><h1>{saud}, Pedro</h1></div></header>

      <div className="card hero">
        <div><div className="lbl">A receber dos clientes</div><div className="big">{brl(d.totalReceber)}</div></div>
        <div className="split">
          <div><div className="k">Recebido em {mes}</div><div className="n">{brl(recebidoMes)}</div></div>
          <div><div className="k">Orçado em {mes}</div><div className="n">{brl(d.orcadoMes)}</div></div>
        </div>
      </div>

      <div className="quick">
        <button onClick={novoOrcamento}><Icon name="doc" />Orçamento</button>
        <button onClick={() => go('visita/nova')}><Icon name="pin" />Visita</button>
        <button onClick={() => go('cliente/novo')}><Icon name="users" />Cliente</button>
      </div>

      {agendaHoje > 0 && (
        <>
          <div className="h2"><h2>Hoje</h2><a className="link" href="#/visitas/agenda">Agenda</a></div>
          <div className="card list">
            {visitasHoje.map((v) => (
              <a key={v.id} className="row" href={`#/visita/${v.id}`}>
                <div className="ic red"><Icon name="pin" /></div>
                <div className="main"><div className="t">Medir: {v.nome}</div><div className="s">{quando(v.data, v.periodo)}{v.endereco ? ` · ${v.endereco}` : ''}</div></div>
              </a>
            ))}
            {servicosHoje.map((o) => (
              <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
                <div className="ic info"><Icon name="helmet" /></div>
                <div className="main"><div className="t">Serviço: {o.clienteNome}</div><div className="s">{quando(o.servicoData ?? null, o.servicoPeriodo)}{o.endereco ? ` · ${o.endereco}` : ''}</div></div>
              </a>
            ))}
          </div>
        </>
      )}

      {atencao && (
        <>
          <div className="h2"><h2>Precisa da sua atenção</h2></div>
          <div className="card list">
            {contasVencendo.map((v) => (
              <a key={v.conta.id + v.data} className="row" href="#/financeiro">
                <div className={`ic ${v.atrasada ? 'red' : 'warn'}`}><Icon name="clock" /></div>
                <div className="main"><div className="t">{v.conta.descricao}</div><div className="s" style={{ color: v.atrasada ? 'var(--red)' : undefined }}>{v.atrasada ? `Atrasada desde ${fmtData(v.data)}` : v.data === hoje ? 'Vence hoje' : `Vence ${fmtData(v.data)}`}</div></div>
                <div className="v">{brl(v.conta.valor)}</div>
              </a>
            ))}
            {pedidosAtencao.map((p) => (
              <a key={p.id} className="row" href={`#/pedido/${p.id}`}>
                <div className="ic red"><Icon name="truck" /></div>
                <div className="main"><div className="t">Pedido nº {p.numero} chegou</div><div className="s">{statusPedido(p).rotulo}</div></div>
                <Icon name="chev" className="chev" />
              </a>
            ))}
            {paraComprar.length > 0 && (
              <a className="row" href="#/bobinas">
                <div className={`ic ${prio.urgente.length ? 'red' : 'mute'}`}><Icon name="coil" /></div>
                <div className="main">
                  <div className="t">{prio.urgente.length ? `${prio.urgente.length} bobina${prio.urgente.length > 1 ? 's' : ''} urgente${prio.urgente.length > 1 ? 's' : ''}` : `${paraComprar.length} bobina${paraComprar.length > 1 ? 's' : ''} para repor`}</div>
                  <div className="s">{prio.urgente.length ? `${prio.urgente.map((i) => i.corte).join(', ')} · e mais ${prio.repor.length} para repor` : paraComprar.slice(0, 6).map((i) => i.corte).join(' · ')}</div>
                </div>
                <Icon name="chev" className="chev" />
              </a>
            )}
            {visitas.length > 0 && (
              <button className="row" onClick={() => go('visitas')}>
                <div className="ic red"><Icon name="pin" /></div>
                <div className="main"><div className="t">{visitas.length} visita{visitas.length > 1 ? 's' : ''} a medir</div><div className="s">{maisAntiga ? (diasEntre(maisAntiga, hoje) >= 2 ? `A mais antiga espera ${haDias(maisAntiga)}` : diasEntre(maisAntiga, hoje) === 1 ? 'A mais antiga é de ontem' : 'Anotadas hoje') : ''}</div></div>
                <Icon name="chev" className="chev" />
              </button>
            )}
            {!nuvem.conectado && (
              <a className="row" href="#/mais/nuvem">
                <div className="ic red"><Icon name="upload" /></div>
                <div className="main"><div className="t">Ligar a nuvem</div><div className="s">Cópia automática de tudo, para não perder nada</div></div>
                <Icon name="chev" className="chev" />
              </a>
            )}
            {nuvem.conectado && nuvem.erro && (
              <a className="row" href="#/mais/nuvem">
                <div className="ic warn"><Icon name="alert" /></div>
                <div className="main"><div className="t">Nuvem</div><div className="s">{nuvem.erro}</div></div>
              </a>
            )}
            {precisaBackup && (
              <button className="row" onClick={() => go('mais/backup')}>
                <div className="ic red"><Icon name="hard" /></div>
                <div className="main"><div className="t">Fazer backup</div><div className="s">{diasBackup == null ? 'Você ainda não fez nenhum' : `O último foi ${haDias(cfg.ultimoBackup!)}`}</div></div>
                <Icon name="chev" className="chev" />
              </button>
            )}
            {d.semResposta.map(({ o }) => (
              <div className="row" key={o.id}>
                <div className="ic warn"><Icon name="clock" /></div>
                <a className="main" href={`#/orcamento/${o.id}`} style={{ textDecoration: 'none' }}><div className="t">{o.clienteNome} não respondeu</div><div className="s">Nº {o.numero} · enviado {haDias(o.enviadoEm ?? o.emitidoEm)}</div></a>
                {o.telefone ? <a className="btn" href={waLink(o.telefone, `Olá, ${o.clienteNome.split(' ')[0]}! Tudo bem? Aqui é da Calhas Andrade. Conseguiu ver o orçamento nº ${o.numero} que mandamos? Qualquer dúvida estou à disposição.`)} target="_blank" rel="noreferrer"><Icon name="wa" />Lembrar</a> : null}
              </div>
            ))}
            {d.rascunhos.length > 0 && (
              <button className="row" onClick={() => go('orcamentos')}>
                <div className="ic mute"><Icon name="edit" /></div>
                <div className="main"><div className="t">{d.rascunhos.length} rascunho{d.rascunhos.length > 1 ? 's' : ''} não enviado{d.rascunhos.length > 1 ? 's' : ''}</div><div className="s">{d.rascunhos.slice(0, 3).map((l) => l.o.clienteNome || 'Sem cliente').join(', ')}</div></div>
                <Icon name="chev" className="chev" />
              </button>
            )}
          </div>
        </>
      )}

      {d.aReceber.length > 0 && (
        <>
          <div className="h2"><h2>A receber</h2></div>
          <div className="card list">
            {d.aReceber.slice(0, 6).map(({ o, pg }) => (
              <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
                <div className="main"><div className="t">{o.clienteNome}</div><div className="s">Nº {o.numero} · {o.pagamentos.length ? `${o.pagamentos.length} de ${Math.max(o.parcelas, o.pagamentos.length)} pagas` : 'nada pago ainda'}</div></div>
                <div className="v">{brl(pg.saldo)}<small>falta</small></div>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="h2"><h2>Últimos orçamentos</h2>{d.ls.length > 0 && <a className="link" href="#/orcamentos">Todos</a>}</div>
      {d.ls.length ? (
        <div className="card list">
          {d.ls.slice(0, 5).map(({ o, total, st }) => (
            <a key={o.id} className="row" href={`#/orcamento/${o.id}`}>
              <div className="main"><div className="t">{o.clienteNome || 'Sem cliente'}</div><div className="s num">Nº {o.numero} · {fmtData(o.emitidoEm)}</div></div>
              <div className="v" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>{brl(total)}<Pill cor={st.cor}>{st.rotulo}</Pill></div>
            </a>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <div className="ic red"><Icon name="doc" /></div>
          <b>Comece pelo primeiro orçamento</b>
          <p>Escolha o cliente, adicione calhas, rufos e acessórios, e mande o PDF no WhatsApp.</p>
          <button className="btn primary" onClick={novoOrcamento}><Icon name="plus" />Novo orçamento</button>
        </div>
      )}
    </section>
  );
}
