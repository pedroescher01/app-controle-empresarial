import { useLiveQuery } from 'dexie-react-hooks';
import { db, getConfig, CONFIG_PADRAO, type Config } from './db';

export function useConfig(): Config {
  return useLiveQuery(getConfig, [], CONFIG_PADRAO);
}

export function useCalheiros() {
  return useLiveQuery(() => db.calheiros.orderBy('nome').toArray(), [], []);
}

export function useClientes() {
  return useLiveQuery(() => db.clientes.orderBy('nome').toArray(), [], []);
}

export function useOrcamentos() {
  return useLiveQuery(() => db.orcamentos.orderBy('atualizadoEm').reverse().toArray(), [], []);
}
