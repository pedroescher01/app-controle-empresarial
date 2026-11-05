# Calhas Andrade · Sistema de gestão

App para o celular (iPhone) do Pedro: orçamentos em PDF no modelo oficial, clientes, calheiros, pagamentos e backup.

- `app/` – o sistema (React + Vite). Dados guardados no próprio aparelho (IndexedDB) até a migração para o Supabase.
- `docs/entrevista.md` – todas as respostas da entrevista (requisitos).
- `prototipo/` – tela de exemplo aprovada.

## Rodar
```bash
cd app && npm install
npm run dev        # desenvolvimento
npx vitest run     # testes dos cálculos e textos do PDF
BASE_PATH=/app-controle-empresarial/ npm run build   # build para o GitHub Pages
```
