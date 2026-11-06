import { db, getConfig, setConfig, TABELAS_DADOS, type Config, type NomeTabela } from './db';
import { hojeISO } from './format';

const VERSAO = 2;

export type Backup = {
  app: 'calhas-andrade';
  versao: number;
  exportadoEm: string;
  dados: Partial<Record<NomeTabela, unknown[]>> & { config: Partial<Config> };
};

const tabela = (n: NomeTabela) => db.table(n);

export async function gerarBackup(): Promise<File> {
  const cfg = await getConfig();
  // o PIN e o Face ID não vão no backup (são deste aparelho)
  const { pinHash: _h, pinSalt: _s, faceIdCred: _f, ...configSemPin } = cfg;
  void _h; void _s; void _f;
  const dados = { config: configSemPin } as Backup['dados'];
  for (const n of TABELAS_DADOS) dados[n] = await tabela(n).toArray();
  const b: Backup = { app: 'calhas-andrade', versao: VERSAO, exportadoEm: new Date().toISOString(), dados };
  return new File([JSON.stringify(b)], `backup-calhas-andrade-${hojeISO()}.json`, { type: 'application/json' });
}

export async function marcarBackupFeito() {
  await setConfig({ ultimoBackup: new Date().toISOString() });
}

export async function lerBackup(file: File): Promise<Backup> {
  const txt = await file.text();
  let b: Backup;
  try {
    b = JSON.parse(txt);
  } catch {
    throw new Error('Esse arquivo não é um backup válido.');
  }
  if (b?.app !== 'calhas-andrade' || !b.dados) throw new Error('Esse arquivo não é um backup do sistema da Calhas Andrade.');
  return b;
}

export async function restaurarBackup(b: Backup) {
  const cfg = await getConfig();
  await db.transaction('rw', [...TABELAS_DADOS.map(tabela), db.config], async () => {
    for (const n of TABELAS_DADOS) {
      await tabela(n).clear();
      await tabela(n).bulkPut((b.dados[n] ?? []) as never[]);
    }
    await db.config.put({ key: 'app', value: { ...cfg, ...b.dados.config, pinHash: cfg.pinHash, pinSalt: cfg.pinSalt, faceIdCred: cfg.faceIdCred } });
  });
}

export function contarBackup(b: Backup) {
  return {
    clientes: b.dados.clientes?.length ?? 0,
    orcamentos: b.dados.orcamentos?.length ?? 0,
    calheiros: b.dados.calheiros?.length ?? 0,
    visitas: b.dados.visitas?.length ?? 0,
  };
}
