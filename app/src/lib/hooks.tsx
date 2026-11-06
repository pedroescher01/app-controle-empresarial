import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { agendarSincronizacao, estadoNuvem, ouvirNuvem, type EstadoNuvem } from './nuvem';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Table } from 'dexie';
import { db, getConfig, type Calheiro, type Cliente, type Config, type Adiantamento, type Bobina, type ContaFixa, type Fornecedor, type Lancamento, type Orcamento, type Pedido, type Visita } from './db';

/**
 * Todos os dados ficam carregados na memória (são poucos) e se atualizam sozinhos.
 * Assim nenhuma tela abre vazia por um instante ao trocar de página (evita a "piscada").
 */
type Dados = {
  config: Config;
  clientes: Cliente[];
  calheiros: Calheiro[];
  orcamentos: Orcamento[];
  visitas: Visita[];
  lancamentos: Lancamento[];
  contasFixas: ContaFixa[];
  bobinas: Bobina[];
  fornecedores: Fornecedor[];
  pedidos: Pedido[];
  adiantamentos: Adiantamento[];
};

const Ctx = createContext<Dados | null>(null);

export function DadosProvider({ children }: { children: ReactNode }) {
  const d = useLiveQuery(async (): Promise<Dados> => {
    const [config, clientes, calheiros, orcamentos, visitas, lancamentos, contasFixas, bobinas, fornecedores, pedidos, adiantamentos] = await Promise.all([
      getConfig(),
      db.clientes.orderBy('nome').toArray(),
      db.calheiros.orderBy('nome').toArray(),
      db.orcamentos.orderBy('atualizadoEm').reverse().toArray(),
      db.visitas.orderBy('criadoEm').reverse().toArray(),
      db.lancamentos.orderBy('data').reverse().toArray(),
      db.contasFixas.toArray(),
      db.bobinas.toArray(),
      db.fornecedores.orderBy('nome').toArray(),
      db.pedidos.orderBy('criadoEm').reverse().toArray(),
      db.adiantamentos.toArray(),
    ]);
    return { config, clientes, calheiros, orcamentos, visitas, lancamentos, contasFixas, bobinas, fornecedores, pedidos, adiantamentos };
  }, []);
  // qualquer mudança nos dados: manda para a nuvem alguns segundos depois
  useEffect(() => {
    if (d && estadoNuvem().conectado) agendarSincronizacao();
  }, [d]);
  if (!d) return null; // só no primeiro instante ao abrir o app
  return <Ctx.Provider value={d}>{children}</Ctx.Provider>;
}

export const useDados = () => useContext(Ctx)!;
export const useConfig = () => useDados().config;
export const useCalheiros = () => useDados().calheiros;
export const useClientes = () => useDados().clientes;
export const useOrcamentos = () => useDados().orcamentos;
export const useVisitas = () => useDados().visitas;
export const useLancamentos = () => useDados().lancamentos;
export const useContasFixas = () => useDados().contasFixas;
export const useBobinas = () => useDados().bobinas;
export const useFornecedores = () => useDados().fornecedores;
export const usePedidos = () => useDados().pedidos;
export const useAdiantamentos = () => useDados().adiantamentos;

/**
 * Um registro pelo id. Vem da memória na hora; se acabou de ser criado e a memória
 * ainda não atualizou, busca direto no banco. undefined = carregando, null = não existe.
 */
export function useRegistro<T extends { id: string }>(lista: T[], tabela: Table<T, string>, id: string | undefined): T | null | undefined {
  const daMemoria = id ? lista.find((x) => x.id === id) : undefined;
  const doBanco = useLiveQuery(async () => (id && !daMemoria ? (await tabela.get(id)) ?? null : null), [id, !!daMemoria]);
  if (!id) return null;
  return daMemoria ?? doBanco;
}

export function useNuvem(): EstadoNuvem {
  const [e, setE] = useState(estadoNuvem());
  useEffect(() => {
    const off = ouvirNuvem(setE);
    return () => { off(); };
  }, []);
  return e;
}
