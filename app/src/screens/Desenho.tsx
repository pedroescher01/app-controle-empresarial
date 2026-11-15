import { useCallback, useEffect, useRef, useState } from 'react';
import { db, setConfig, type Orcamento, type PadraoDesenho, type Peca } from '../lib/db';
import { go } from '../lib/router';
import { useConfig, useOrcamentos, useRegistro } from '../lib/hooks';
import { calcular } from '../lib/calc';
import { PADROES_INICIAIS, notasProducao, sincronizarItens, somaMetr, valorDaJogada } from '../lib/desenho';
import { brl, fmtData, qtd } from '../lib/format';
import { Empty, useToast } from '../components/ui';
import { criarFolha } from '../desenho/motor';

/**
 * Folha de desenho (para o computador, com mouse): desenha as peças e o orçamento vai se fazendo.
 * As peças ficam guardadas dentro do próprio orçamento (`pecas`) e cada peça pronta vira um item por metro,
 * então preço, "Fechar em", PDF, pagamentos e nuvem continuam sendo os do orçamento normal.
 */
export function DesenhoTela({ id }: { id: string }) {
  const orc = useRegistro(useOrcamentos(), db.orcamentos, id);
  if (orc === undefined) return null;
  if (!orc) return <Empty icon="doc" title="Orçamento não encontrado" action={<button className="btn" onClick={() => go('orcamentos')}>Voltar</button>} />;
  return <Folha key={orc.id} inicial={orc} />;
}

type Modelo = { cliente: string; data: string; num: number; caneta: 'preta' | 'azul'; pecas: Peca[] };
type Motor = ReturnType<typeof criarFolha>;
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const modeloDe = (o: Orcamento): Modelo => ({ cliente: o.clienteNome, data: o.emitidoEm, num: o.numero, caneta: o.caneta ?? 'preta', pecas: copia(o.pecas ?? []) });
const marca = (m: Modelo) => JSON.stringify([m.pecas, m.caneta]);

function Folha({ inicial }: { inicial: Orcamento }) {
  const cfg = useConfig();
  const toast = useToast();
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const motor = useRef<Motor | null>(null);
  const modelo = useRef<Modelo>(modeloDe(inicial));
  const padroes = useRef<PadraoDesenho[]>(copia(cfg.padroesDesenho ?? PADROES_INICIAIS));
  const padroesGravados = useRef(JSON.stringify(padroes.current));

  // a versão mais nova que está no banco (itens digitados, desconto, etc. vêm sempre dela)
  const doBanco = useOrcamentos().find((x) => x.id === inicial.id) ?? inicial;
  const banco = useRef(doBanco);
  banco.current = doBanco;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const gravada = useRef(marca(modelo.current));
  const ultimaGravada = useRef(inicial.atualizadoEm);
  const timer = useRef<number>();

  /** Itens e "Fechar em" que o orçamento deve ter com o desenho de agora. */
  const montar = useCallback((o: Orcamento, pecas: Peca[], jogada = o.jogadaAuto) => {
    const itens = sincronizarItens(o.itens, pecas);
    const patch: Partial<Orcamento> = { itens };
    if (jogada) patch.totalDesejado = valorDaJogada(calcular({ itens, desconto: 0, totalDesejado: null }, cfgRef.current).subtotalBase);
    return patch;
  }, []);

  // grava só quando o desenho mudou de verdade (tela aberta não regrava por cima da nuvem)
  const gravar = useCallback(() => {
    window.clearTimeout(timer.current);
    const m = modelo.current;
    const agora = JSON.stringify(padroes.current);
    if (agora !== padroesGravados.current) { padroesGravados.current = agora; void setConfig({ padroesDesenho: copia(padroes.current) }); }
    const nova = marca(m);
    if (nova === gravada.current) return;
    gravada.current = nova;
    const pecas = copia(m.pecas);
    const quando = new Date().toISOString();
    ultimaGravada.current = quando;
    return db.orcamentos.update(banco.current.id, { pecas, caneta: m.caneta, ...montar(banco.current, pecas), atualizadoEm: quando });
  }, [montar]);

  const [resumo, setResumo] = useState({ pecas: 0, metros: 0, total: 0, faltam: 0 });
  const chaveResumo = useRef('');
  const atualizarResumo = useCallback(() => {
    const m = modelo.current;
    const o = banco.current;
    const chave = JSON.stringify([m.pecas.map((p) => [p.med, p.metr, p.nome]), o.atualizadoEm, cfgRef.current.precoMetro]);
    if (chave === chaveResumo.current) return;
    chaveResumo.current = chave;
    const patch = montar(o, m.pecas);
    const r = calcular({ itens: patch.itens!, desconto: o.desconto, totalDesejado: 'totalDesejado' in patch ? patch.totalDesejado! : o.totalDesejado }, cfgRef.current);
    const prontas = patch.itens!.filter((i) => i.pecaId).length;
    setResumo({ pecas: m.pecas.length, metros: m.pecas.reduce((s, p) => s + somaMetr(p.metr), 0), total: r.total, faltam: m.pecas.length - prontas });
  }, [montar]);

  const imprimir = useCallback((comBatidas: boolean) => {
    const mt = motor.current;
    if (!mt) return;
    void gravar();
    const o = banco.current;
    const m = modelo.current;
    if (!m.pecas.length) { toastRef.current('Desenhe alguma peça primeiro'); return; }
    const pecas = copia(m.pecas);
    const notas = notasProducao({ itens: sincronizarItens(o.itens, pecas), pecas });
    const paginas: string[] = mt.paginasProducao({ ...m, pecas }, { bat: comBatidas, notas });
    document.querySelector('.dz-print')?.remove();
    const raiz = document.createElement('div');
    raiz.className = 'dz-print';
    raiz.innerHTML = paginas.map((s) => `<section class="dz-pg">${s}</section>`).join('');
    document.body.appendChild(raiz);
    const titulo = document.title;
    document.title = `Folha de produção ${o.numero}${o.clienteNome ? ` - ${o.clienteNome}` : ''}`;
    const limpar = () => { document.title = titulo; raiz.remove(); window.removeEventListener('afterprint', limpar); };
    window.addEventListener('afterprint', limpar);
    window.setTimeout(() => window.print(), 80);
  }, [gravar]);

  // liga o motor uma vez; ao sair, termina a peça em andamento e grava o que faltou
  useEffect(() => {
    const mt = criarFolha(host.current, svg.current, {
      padroes: padroes.current,
      toast: (msg: string) => toastRef.current(msg),
      mudou: () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(gravar, 350); },
      desenhou: atualizarResumo,
      imprimir,
    });
    motor.current = mt;
    mt.abrir(modelo.current);
    document.body.classList.add('dz-aberta');
    return () => {
      mt.terminar();
      void gravar();
      mt.destruir();
      motor.current = null;
      document.body.classList.remove('dz-aberta');
    };
  }, [gravar, atualizarResumo, imprimir]);

  // mudou por fora (nuvem, outro aparelho): pega o desenho novo se você não está no meio de uma peça
  useEffect(() => {
    atualizarResumo();
    const mt = motor.current;
    if (!mt || doBanco.atualizadoEm === ultimaGravada.current) return;
    ultimaGravada.current = doBanco.atualizadoEm;
    const novo = modeloDe(doBanco);
    if (marca(novo) === gravada.current || mt.ocupado()) return;
    modelo.current = novo;
    gravada.current = marca(novo);
    mt.trocar(novo);
  }, [doBanco, atualizarResumo]);

  const alternarJogada = () => {
    void gravar();
    const o = banco.current;
    const ligar = !o.jogadaAuto;
    const quando = new Date().toISOString();
    ultimaGravada.current = quando;
    void db.orcamentos.update(o.id, { jogadaAuto: ligar, totalDesejado: ligar ? montar(o, modelo.current.pecas, true).totalDesejado ?? null : null, atualizadoEm: quando });
    toast(ligar ? 'Jogada ligada: soma 5% e arredonda pra cima' : 'Jogada desligada');
  };

  const soToque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

  return (
    <div className="dz" ref={host}>
      <svg className="dz-folha" ref={svg} xmlns="http://www.w3.org/2000/svg" />
      <div className="dz-topo">
        <button onClick={() => go(`orcamento/${inicial.id}`)} title="Voltar para o orçamento">‹ Orçamento nº {inicial.numero}</button>
        <span className="dz-esp" />
        <span className="dz-resumo">
          {resumo.pecas} {resumo.pecas === 1 ? 'peça' : 'peças'} · {qtd(resumo.metros)} m · <b>{brl(resumo.total)}</b>
          {resumo.faltam > 0 && <i> · {resumo.faltam} sem medida ou metragem</i>}
        </span>
        <button aria-pressed={!!doBanco.jogadaAuto} onClick={alternarJogada} title="Soma 5% no total e arredonda pra cima (vira o Fechar em do orçamento)">Jogada +5%</button>
        <button onClick={() => motor.current?.paleta()}>Padrões <kbd>P</kbd></button>
        <button onClick={() => imprimir(!!motor.current?.batidas())}>Imprimir <kbd>Ctrl P</kbd></button>
        <button onClick={() => motor.current?.ajuda()}>Atalhos <kbd>F1</kbd></button>
      </div>
      {resumo.pecas === 0 && <div className="dz-dica">Clica, arrasta, solta e digita a medida. <kbd>P</kbd> abre as peças prontas. <kbd>F1</kbd> mostra os atalhos.</div>}
      {soToque && <div className="dz-aviso">A folha de desenho é para usar no computador, com mouse. Orçamento de {fmtData(inicial.emitidoEm)}.</div>}
    </div>
  );
}
