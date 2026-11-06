import type { ItemTipo } from './db';

export type CatalogItem = {
  key: string;
  descricao: string;
  /** nome curto para o botão de adicionar */
  chip: string;
  unidade: string;
  tipo: ItemTipo;
  preco: number;
  corte?: number | null;
  condutor?: boolean;
  grupo: 'Calhas e rufos' | 'Condutores' | 'Acessórios' | 'Serviço';
};

export const CATALOGO: CatalogItem[] = [
  { key: 'calha', descricao: 'Calha', chip: 'Calha', unidade: 'm', tipo: 'metro', preco: 0, corte: 33, grupo: 'Calhas e rufos' },
  { key: 'rufo', descricao: 'Rufo', chip: 'Rufo', unidade: 'm', tipo: 'metro', preco: 0, corte: 25, grupo: 'Calhas e rufos' },
  { key: 'pingadeira', descricao: 'Pingadeira', chip: 'Pingadeira', unidade: 'm', tipo: 'metro', preco: 0, corte: 20, grupo: 'Calhas e rufos' },
  { key: 'calhas_rufos', descricao: 'Calhas e rufos', chip: 'Calhas e rufos', unidade: 'm', tipo: 'metro', preco: 0, corte: null, grupo: 'Calhas e rufos' },
  { key: 'chapa', descricao: 'Chapa', chip: 'Chapa', unidade: 'm', tipo: 'metro', preco: 0, corte: 120, grupo: 'Calhas e rufos' },
  { key: 'mao', descricao: 'Mão de obra', chip: 'Mão de obra', unidade: 'un', tipo: 'mao', preco: 0, grupo: 'Serviço' },
  { key: 'cond_q25', descricao: 'Condutor quadrado 25', chip: 'Condutor 25', unidade: 'm', tipo: 'unidade', preco: 25, condutor: true, grupo: 'Condutores' },
  { key: 'cond_q28', descricao: 'Condutor quadrado 28', chip: 'Condutor 28', unidade: 'm', tipo: 'unidade', preco: 25, condutor: true, grupo: 'Condutores' },
  { key: 'cond_q33', descricao: 'Condutor quadrado 33', chip: 'Condutor 33', unidade: 'm', tipo: 'unidade', preco: 25, condutor: true, grupo: 'Condutores' },
  { key: 'cond_r3', descricao: 'Condutor redondo 3"', chip: 'Condutor 3"', unidade: 'm', tipo: 'unidade', preco: 30, condutor: true, grupo: 'Condutores' },
  { key: 'bocal2', descricao: 'Bocal 2"', chip: 'Bocal 2"', unidade: 'un', tipo: 'unidade', preco: 10, grupo: 'Acessórios' },
  { key: 'bocal3', descricao: 'Bocal 3"', chip: 'Bocal 3"', unidade: 'un', tipo: 'unidade', preco: 10, grupo: 'Acessórios' },
  { key: 'bocal4', descricao: 'Bocal 4"', chip: 'Bocal 4"', unidade: 'un', tipo: 'unidade', preco: 10, grupo: 'Acessórios' },
  { key: 'suporte', descricao: 'Suporte para calha', chip: 'Suporte', unidade: 'un', tipo: 'unidade', preco: 15, grupo: 'Acessórios' },
  { key: 'curva', descricao: 'Par de curva', chip: 'Par de curva', unidade: 'par', tipo: 'unidade', preco: 75, grupo: 'Acessórios' },
  { key: 'silicone', descricao: 'Silicone', chip: 'Silicone', unidade: 'un', tipo: 'unidade', preco: 35, grupo: 'Acessórios' },
  { key: 'estanho', descricao: 'Estanho', chip: 'Estanho', unidade: 'un', tipo: 'unidade', preco: 35, grupo: 'Acessórios' },
  { key: 'brocante', descricao: 'Brocante', chip: 'Brocante', unidade: 'un', tipo: 'unidade', preco: 0.3, grupo: 'Acessórios' },
  { key: 'bucha6', descricao: 'Bucha 6', chip: 'Bucha 6', unidade: 'un', tipo: 'unidade', preco: 0.3, grupo: 'Acessórios' },
  { key: 'bucha8', descricao: 'Bucha 8', chip: 'Bucha 8', unidade: 'un', tipo: 'unidade', preco: 0.3, grupo: 'Acessórios' },
  { key: 'rebite', descricao: 'Rebite', chip: 'Rebite', unidade: 'un', tipo: 'unidade', preco: 0.3, grupo: 'Acessórios' },
];

/** Cortes de bobina (cm). De 70 a 115 saem do corte de 120, mas cobra-se só a largura usada. */
export const CORTES_BOBINA = [10, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 45, 50, 55, 60, 65, 120];
export const CORTES = [10, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120];

export const UNIDADES = ['m', 'un', 'par', 'barra', 'kg', 'cx'];

export const FORMAS_PAGAMENTO = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Boleto', 'Cheque'];
/** Pagamento que o cliente fez direto ao calheiro (mão de obra): não entra no financeiro da Calhas Andrade. */
export const DIRETO_CALHEIRO = 'Direto ao calheiro';

export const CONTAS = ['Sicoob', 'InfinitePay', 'Caixa (dinheiro)'];

export function contaPadrao(forma: string) {
  if (forma.startsWith('Cartão')) return 'InfinitePay';
  if (forma === 'Dinheiro') return 'Caixa (dinheiro)';
  return 'Sicoob';
}

/** Rótulo da forma de pagamento como aparece no PDF: "(Pix)", "(cartão)". */
export function formaCurta(forma: string) {
  if (forma.startsWith('Cartão de crédito')) return 'cartão de crédito';
  if (forma.startsWith('Cartão de débito')) return 'cartão de débito';
  return forma === 'Pix' ? 'Pix' : forma.toLowerCase();
}

export const precoCatalogo = (item: CatalogItem, precos: Record<string, number>) =>
  precos[item.key] ?? item.preco;
