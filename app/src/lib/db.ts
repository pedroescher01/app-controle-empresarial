import Dexie, { type Table } from 'dexie';

export type Endereco = {
  id: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento: string;
};

export type Cliente = {
  id: string;
  nome: string;
  tipo: 'pf' | 'pj';
  documento: string;
  telefone: string;
  telefone2: string;
  enderecos: Endereco[];
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Calheiro = { id: string; nome: string; telefone: string; ativo: boolean; criadoEm: string };

/** metro = calha/rufo/chapa (preço pelo corte); unidade = acessórios e condutor; mao = mão de obra. */
export type ItemTipo = 'metro' | 'unidade' | 'mao';

export type Item = {
  id: string;
  tipo: ItemTipo;
  catalogo?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** cm; só para tipo metro */
  corte?: number | null;
  chapa?: 24 | 26;
  /** preço unitário digitado (itens por unidade, ou metro sem corte / com preço manual) */
  precoUnit: number;
  precoManual?: boolean;
  condutor?: boolean;
};

export type Pagamento = { id: string; data: string; valor: number; forma: string; conta: string };

export type StatusOrc = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';

export type Orcamento = {
  id: string;
  numero: number;
  clienteId: string | null;
  clienteNome: string;
  telefone: string;
  endereco: string;
  calheiroIds: string[];
  modo: 'simples' | 'detalhado';
  itens: Item[];
  desconto: number;
  /** "Fechar em": total final desejado; a diferença vai só nos itens por metro */
  totalDesejado: number | null;
  valorAVista: number | null;
  observacoes: string;
  status: StatusOrc;
  emitidoEm: string;
  validoAte: string | null;
  enviadoEm: string | null;
  aprovadoEm: string | null;
  parcelas: number;
  pagamentos: Pagamento[];
  /** serviço agendado (instalação) */
  servicoData?: string | null;
  servicoPeriodo?: Periodo | null;
  /** este orçamento foi juntado em outro (id do orçamento novo) */
  juntadoNo?: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type Escada = 'normal' | 'alta' | 'muito_alta';
export type Periodo = 'manha' | 'tarde';

export type Visita = {
  id: string;
  clienteId: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  /** o que precisa ver: atalhos (Calha, Rufo…) */
  precisa: string[];
  /** o que precisa ver: texto livre */
  detalhe: string;
  escada: Escada;
  status: 'a_medir' | 'medido';
  /** data combinada (opcional; na maioria das vezes não tem) */
  data: string | null;
  periodo: Periodo | null;
  /** calheiro que vai / que mediu */
  calheiroId: string | null;
  medidoEm: string | null;
  orcamentoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

/** Estado de cada bobina (corte × chapa). Tem 2 de cada: uma na produção e outra no estoque. */
export type Bobina = {
  /** "26-33" = chapa 26, corte 33 */
  id: string;
  corte: number;
  chapa: 24 | 26;
  /** ok = tem a do estoque; comprar = a do estoque foi para a produção */
  estado: 'ok' | 'comprar';
  atualizadoEm: string;
};

export type Fornecedor = {
  id: string;
  nome: string;
  cnpj: string;
  vendedor: string;
  telefone: string;
  criadoEm: string;
};

export type ItemPedido = { corte: number; chapa: 24 | 26; quantidade: number };

export type Pedido = {
  id: string;
  numero: number;
  fornecedorId: string | null;
  itens: ItemPedido[];
  observacoes: string;
  /** datas de cada etapa (null = ainda não) */
  pedidoEm: string | null;
  notaEm: string | null;
  chegouEm: string | null;
  pagoEm: string | null;
  /** valores da nota do fornecedor */
  valorTotal: number | null;
  pesoKg: number | null;
  precoKg26: number | null;
  precoKg24: number | null;
  formaPagamento: string;
  contaPagamento: string;
  criadoEm: string;
  atualizadoEm: string;
};

/**
 * Material que o calheiro leva adiantado (fica no carro) e vai sendo descontado nos serviços.
 * quantidade > 0 = pegou; < 0 = descontado num orçamento. O saldo é a soma.
 */
export type Adiantamento = {
  id: string;
  calheiroId: string;
  /** chave do item: catálogo ("silicone") ou "desc:<descrição>" */
  chave: string;
  descricao: string;
  quantidade: number;
  data: string;
  orcamentoId: string | null;
  criadoEm: string;
};

export type Lancamento = {
  id: string;
  tipo: 'entrada' | 'saida';
  data: string;
  valor: number;
  descricao: string;
  categoria: string;
  forma: string;
  conta: string;
  orcamentoId?: string;
  pagamentoId?: string;
  /** taxa da maquininha descontada (cartão) */
  taxa?: number;
  /** conta fixa paga com este lançamento, e o vencimento a que se refere */
  contaFixaId?: string;
  referencia?: string;
  /** pedido de compra pago com este lançamento */
  pedidoId?: string;
  criadoEm: string;
};

/** Conta que se repete (aluguel, DAS, internet, retirada semanal) ou conta avulsa com vencimento (boleto). */
export type ContaFixa = {
  id: string;
  descricao: string;
  categoria: string;
  /** valor de sempre (pode mudar na hora de pagar, ex.: conta de luz) */
  valor: number;
  repete: 'mensal' | 'semanal' | 'unica';
  /** mensal: dia do mês (1–31); semanal: dia da semana (0 = domingo … 6 = sábado) */
  dia: number;
  /** só para 'unica' */
  vencimento: string | null;
  ativa: boolean;
  criadoEm: string;
};

export type Config = {
  precoMetro: number;
  /** chapa 24 = chapa 26 × fator (1,5 = 50% mais cara) */
  fatorChapa24: number;
  validadeDias: number;
  email: string;
  precos: Record<string, number>;
  tema: 'auto' | 'claro' | 'escuro';
  ultimoBackup: string | null;
  pinHash: string | null;
  pinSalt: string | null;
  /** chave do Face ID (id da chave-senha do iPhone) */
  faceIdCred: string | null;
  /** taxas da maquininha (%), descontadas das entradas no cartão */
  taxaCredito: number;
  taxaDebito: number;
  /** Pix para cobrança (QR e copia e cola) */
  pixChave: string;
  pixNome: string;
  pixCidade: string;
  /** mostrar o QR do Pix no PDF do orçamento (quando falta pagar) */
  pixNoPdf: boolean;
};

export const EMAIL_PADRAO = 'calhasandradeararas@gmail.com';

export const CONFIG_PADRAO: Config = {
  precoMetro: 60,
  fatorChapa24: 1.5,
  validadeDias: 15,
  email: EMAIL_PADRAO,
  precos: {},
  tema: 'auto',
  ultimoBackup: null,
  pinHash: null,
  pinSalt: null,
  faceIdCred: null,
  taxaCredito: 0,
  taxaDebito: 0,
  pixChave: '',
  pixNome: '',
  pixCidade: 'Araras',
  pixNoPdf: false,
};

type ConfigRow = { key: string; value: Config };

class CalhasDB extends Dexie {
  clientes!: Table<Cliente, string>;
  calheiros!: Table<Calheiro, string>;
  orcamentos!: Table<Orcamento, string>;
  lancamentos!: Table<Lancamento, string>;
  visitas!: Table<Visita, string>;
  contasFixas!: Table<ContaFixa, string>;
  bobinas!: Table<Bobina, string>;
  fornecedores!: Table<Fornecedor, string>;
  pedidos!: Table<Pedido, string>;
  /** controle da sincronização com a nuvem: chave "tabela:id" → impressão do registro já enviado */
  sync!: Table<{ chave: string; marca: string }, string>;
  adiantamentos!: Table<Adiantamento, string>;
  config!: Table<ConfigRow, string>;

  constructor() {
    super('calhas-andrade');
    this.version(1).stores({
      clientes: 'id, nome, atualizadoEm',
      calheiros: 'id, nome',
      orcamentos: 'id, &numero, clienteId, status, emitidoEm, atualizadoEm',
      lancamentos: 'id, data, tipo, orcamentoId, pagamentoId',
      config: 'key',
    });
    this.version(2).stores({
      visitas: 'id, status, clienteId, data, criadoEm, atualizadoEm',
      orcamentos: 'id, &numero, clienteId, status, emitidoEm, atualizadoEm, servicoData',
    });
    this.version(3).stores({
      contasFixas: 'id, ativa',
      lancamentos: 'id, data, tipo, orcamentoId, pagamentoId, contaFixaId',
    });
    this.version(4).stores({
      bobinas: 'id',
      fornecedores: 'id, nome',
      pedidos: 'id, numero, fornecedorId, criadoEm',
      lancamentos: 'id, data, tipo, orcamentoId, pagamentoId, contaFixaId, pedidoId',
    });
    this.version(5).stores({ sync: 'chave' });
    this.version(6).stores({ adiantamentos: 'id, calheiroId, orcamentoId' });
  }
}

export const db = new CalhasDB();

export async function getConfig(): Promise<Config> {
  const row = await db.config.get('app');
  const c = { ...CONFIG_PADRAO, ...(row?.value ?? {}) };
  if (!c.email) c.email = EMAIL_PADRAO;
  return c;
}

export async function setConfig(patch: Partial<Config>) {
  const atual = await getConfig();
  await db.config.put({ key: 'app', value: { ...atual, ...patch } });
}

/** Número aleatório de 4 dígitos que nunca repete. */
export async function novoNumeroOrcamento(): Promise<number> {
  for (let i = 0; i < 200; i++) {
    const n = 1000 + Math.floor(Math.random() * 9000);
    if (!(await db.orcamentos.where('numero').equals(n).count())) return n;
  }
  for (let i = 0; i < 200; i++) {
    const n = 10000 + Math.floor(Math.random() * 90000);
    if (!(await db.orcamentos.where('numero').equals(n).count())) return n;
  }
  throw new Error('Não foi possível gerar um número de orçamento.');
}

/** Pede ao Safari para não apagar os dados do app. */
export async function pedirArmazenamentoPersistente() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* sem suporte */
  }
}

/** Todas as tabelas de dados (o backup usa esta lista; toda tabela nova entra aqui). */
export const TABELAS_DADOS = ['clientes', 'calheiros', 'orcamentos', 'lancamentos', 'visitas', 'contasFixas', 'bobinas', 'fornecedores', 'pedidos', 'adiantamentos'] as const;
export type NomeTabela = (typeof TABELAS_DADOS)[number];
