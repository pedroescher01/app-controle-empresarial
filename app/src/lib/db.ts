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
  criadoEm: string;
  atualizadoEm: string;
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
};

type ConfigRow = { key: string; value: Config };

class CalhasDB extends Dexie {
  clientes!: Table<Cliente, string>;
  calheiros!: Table<Calheiro, string>;
  orcamentos!: Table<Orcamento, string>;
  lancamentos!: Table<Lancamento, string>;
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
