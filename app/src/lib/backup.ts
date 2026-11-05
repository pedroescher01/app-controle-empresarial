import { db, getConfig, setConfig, type Config } from './db';
import { hojeISO } from './format';

const VERSAO = 1;

export type Backup = {
  app: 'calhas-andrade';
  versao: number;
  exportadoEm: string;
  dados: {
    clientes: unknown[];
    calheiros: unknown[];
    orcamentos: unknown[];
    lancamentos: unknown[];
    config: Partial<Config>;
  };
};

export async function gerarBackup(): Promise<File> {
  const cfg = await getConfig();
  // o PIN não vai no backup
  const { pinHash: _h, pinSalt: _s, ...configSemPin } = cfg;
  void _h; void _s;
  const b: Backup = {
    app: 'calhas-andrade',
    versao: VERSAO,
    exportadoEm: new Date().toISOString(),
    dados: {
      clientes: await db.clientes.toArray(),
      calheiros: await db.calheiros.toArray(),
      orcamentos: await db.orcamentos.toArray(),
      lancamentos: await db.lancamentos.toArray(),
      config: configSemPin,
    },
  };
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
  await db.transaction('rw', [db.clientes, db.calheiros, db.orcamentos, db.lancamentos, db.config], async () => {
    await Promise.all([db.clientes.clear(), db.calheiros.clear(), db.orcamentos.clear(), db.lancamentos.clear()]);
    await db.clientes.bulkPut(b.dados.clientes as never[]);
    await db.calheiros.bulkPut(b.dados.calheiros as never[]);
    await db.orcamentos.bulkPut(b.dados.orcamentos as never[]);
    await db.lancamentos.bulkPut(b.dados.lancamentos as never[]);
    await db.config.put({ key: 'app', value: { ...cfg, ...b.dados.config, pinHash: cfg.pinHash, pinSalt: cfg.pinSalt } });
  });
}

export function contarBackup(b: Backup) {
  return {
    clientes: b.dados.clientes.length,
    orcamentos: b.dados.orcamentos.length,
    calheiros: b.dados.calheiros.length,
  };
}
