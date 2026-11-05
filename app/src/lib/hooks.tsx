import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Table } from 'dexie';
import { db, getConfig, type Calheiro, type Cliente, type Config, type Lancamento, type Orcamento, type Visita } from './db';

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
};

const Ctx = createContext<Dados | null>(null);

export function DadosProvider({ children }: { children: ReactNode }) {
  const d = useLiveQuery(async (): Promise<Dados> => {
    const [config, clientes, calheiros, orcamentos, visitas, lancamentos] = await Promise.all([
      getConfig(),
      db.clientes.orderBy('nome').toArray(),
      db.calheiros.orderBy('nome').toArray(),
      db.orcamentos.orderBy('atualizadoEm').reverse().toArray(),
      db.visitas.orderBy('criadoEm').reverse().toArray(),
      db.lancamentos.orderBy('data').reverse().toArray(),
    ]);
    return { config, clientes, calheiros, orcamentos, visitas, lancamentos };
  }, []);
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
