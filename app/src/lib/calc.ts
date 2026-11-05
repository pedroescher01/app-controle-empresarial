import type { Config, Item, Orcamento, Calheiro } from './db';
import { r2, fmtData, dec2, hojeISO } from './format';
import { formaCurta } from './catalog';

type Precos = Pick<Config, 'precoMetro' | 'fatorChapa24'>;

/** Preço por metro de um item de calha/rufo: corte(m) × preço do metro × fator da chapa. */
export function precoMetroItem(it: Item, cfg: Precos) {
  const fator = it.chapa === 24 ? cfg.fatorChapa24 : 1;
  return r2(((it.corte ?? 0) / 100) * cfg.precoMetro * fator);
}

export function precoUnitario(it: Item, cfg: Precos) {
  if (it.tipo === 'metro' && it.corte && !it.precoManual) return precoMetroItem(it, cfg);
  return it.precoUnit;
}

export type Linha = {
  item: Item;
  /** preço unitário mostrado (após ajuste, pode ter arredondamento) */
  unit: number;
  total: number;
  ajuste: number;
};

export type Resultado = {
  linhas: Linha[];
  subtotalBase: number;
  subtotal: number;
  desconto: number;
  total: number;
  /** o "Fechar em" não pôde ser aplicado (não há calha/rufo) */
  ajusteImpossivel: boolean;
};

/**
 * Calcula o orçamento. Se houver "Fechar em", a diferença para o total desejado é dividida
 * igualmente (até o centavo) apenas entre os itens por metro (calhas, rufos, chapa).
 */
export function calcular(orc: Pick<Orcamento, 'itens' | 'desconto' | 'totalDesejado'>, cfg: Precos): Resultado {
  const base = orc.itens.map((it) => {
    const unit = precoUnitario(it, cfg);
    return { item: it, unitBase: unit, base: r2(it.quantidade * unit) };
  });
  const subtotalBase = r2(base.reduce((s, l) => s + l.base, 0));
  const desconto = r2(orc.desconto || 0);
  const ajustes = base.map(() => 0);
  let ajusteImpossivel = false;

  if (orc.totalDesejado != null && orc.totalDesejado > 0) {
    const alvoSubtotal = r2(orc.totalDesejado + desconto);
    const diffC = Math.round((alvoSubtotal - subtotalBase) * 100);
    const idx = base.map((l, i) => (l.item.tipo === 'metro' && l.item.quantidade > 0 ? i : -1)).filter((i) => i >= 0);
    if (diffC !== 0) {
      if (!idx.length) ajusteImpossivel = true;
      else {
        const parte = Math.trunc(diffC / idx.length);
        let resto = diffC - parte * idx.length;
        const passo = Math.sign(resto);
        idx.forEach((i) => {
          let c = parte;
          if (resto !== 0) {
            c += passo;
            resto -= passo;
          }
          ajustes[i] = c / 100;
        });
      }
    }
  }

  const linhas: Linha[] = base.map((l, i) => {
    const total = r2(l.base + ajustes[i]);
    const unit = ajustes[i] && l.item.quantidade ? r2(total / l.item.quantidade) : l.unitBase;
    return { item: l.item, unit, total, ajuste: ajustes[i] };
  });
  const subtotal = r2(linhas.reduce((s, l) => s + l.total, 0));
  return { linhas, subtotalBase, subtotal, desconto, total: r2(subtotal - desconto), ajusteImpossivel };
}

// ---------- pagamentos ----------
export type SituacaoPagamento = 'em_aberto' | 'parcial' | 'quitado';

export function resumoPagamentos(orc: Pick<Orcamento, 'pagamentos'>, total: number) {
  const pago = r2(orc.pagamentos.reduce((s, p) => s + p.valor, 0));
  const saldo = r2(Math.max(0, total - pago));
  const situacao: SituacaoPagamento = pago <= 0 ? 'em_aberto' : pago >= total - 0.004 ? 'quitado' : 'parcial';
  return { pago, saldo, situacao };
}

export type StatusVisual = { rotulo: string; cor: 'mute' | 'info' | 'warn' | 'ok' | 'red'; chave: string };

export function statusVisual(orc: Orcamento, total: number): StatusVisual {
  const { situacao } = resumoPagamentos(orc, total);
  if (orc.pagamentos.length && situacao === 'quitado') return { rotulo: 'Quitado', cor: 'ok', chave: 'quitado' };
  if (orc.pagamentos.length) return { rotulo: 'Pago em parte', cor: 'warn', chave: 'receber' };
  switch (orc.status) {
    case 'rascunho':
      return { rotulo: 'Rascunho', cor: 'mute', chave: 'rascunho' };
    case 'recusado':
      return { rotulo: 'Recusado', cor: 'mute', chave: 'recusado' };
    case 'aprovado':
      return { rotulo: 'A receber', cor: 'red', chave: 'receber' };
    case 'enviado':
      if (orc.validoAte && orc.validoAte < hojeISO()) return { rotulo: 'Vencido', cor: 'warn', chave: 'aguardando' };
      return { rotulo: 'Aguardando', cor: 'info', chave: 'aguardando' };
  }
}

// ---------- textos do PDF ----------

/** "Edgar - (Zé Carlos)"; sem calheiro repete o cliente: "Ivan - (Ivan)". */
export function nomeClientePDF(orc: Pick<Orcamento, 'clienteNome' | 'calheiroIds'>, calheiros: Calheiro[]) {
  const nomes = orc.calheiroIds.map((id) => calheiros.find((c) => c.id === id)?.nome).filter(Boolean) as string[];
  const entre = nomes.length ? juntarNomes(nomes) : orc.clienteNome;
  return `${orc.clienteNome} - (${entre})`;
}

export function juntarNomes(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function nomeArquivo(orc: Pick<Orcamento, 'numero' | 'clienteNome'>, quitado: boolean) {
  const nome = (orc.clienteNome || 'Cliente').replace(/[\\/:*?"<>|]/g, '').trim();
  return `Orçamento ${orc.numero} - ${nome}${quitado ? ' - PAGO' : ''}.pdf`;
}

/** Linhas automáticas das OBSERVAÇÕES: valor à vista e pagamentos. */
export function linhasObservacoes(orc: Orcamento, total: number) {
  const linhas: string[] = [];
  if (orc.valorAVista && orc.valorAVista > 0)
    linhas.push(`Em caso de pagamento à vista, o valor será R$ ${dec2(orc.valorAVista)}.`);
  orc.observacoes
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .forEach((l) => linhas.push(l));

  let quitado = false;
  if (orc.pagamentos.length) {
    const pags = [...orc.pagamentos].sort((a, b) => a.data.localeCompare(b.data));
    const n = Math.max(orc.parcelas || 1, pags.length);
    let acumulado = 0;
    pags.forEach((p, i) => {
      acumulado = r2(acumulado + p.valor);
      const falta = r2(Math.max(0, total - acumulado));
      linhas.push(
        `Parcela ${i + 1} de ${n} - paga em ${fmtData(p.data)} - R$ ${dec2(p.valor)} (${formaCurta(p.forma)}) - falta R$ ${dec2(falta)}`,
      );
    });
    const { pago, saldo, situacao } = resumoPagamentos(orc, total);
    quitado = situacao === 'quitado';
    linhas.push(quitado ? `Total pago: R$ ${dec2(pago)} - orçamento quitado.` : `Total pago: R$ ${dec2(pago)} - falta R$ ${dec2(saldo)}`);
  }
  return { linhas, quitado };
}

export function enderecoTexto(e: { logradouro: string; numero: string; bairro: string; cidade: string; uf: string; complemento?: string }) {
  const rua = [e.logradouro.trim(), e.numero.trim()].filter(Boolean).join(', ');
  const partes = [rua + (e.complemento?.trim() ? ` ${e.complemento.trim()}` : ''), e.bairro.trim()].filter(Boolean);
  const cidade = e.cidade.trim();
  if (cidade && cidade.toLowerCase() !== 'araras') partes.push(cidade + (e.uf && e.uf !== 'SP' ? `/${e.uf}` : ''));
  return partes.join(' - ') || cidade;
}
