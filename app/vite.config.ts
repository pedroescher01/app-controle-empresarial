/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const VERSAO = new Date().toISOString();

/** Grava versao.json no build: o app compara com a versão dele e se atualiza sozinho. */
const versao = (): Plugin => ({
  name: 'versao',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao: VERSAO }) });
  },
});

export default defineConfig({
  plugins: [react(), versao()],
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  // em produção (GitHub Pages) o app fica em /app-controle-empresarial/
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASE_PATH ?? '/',
  test: { include: ['src/**/*.test.ts'] },
});
