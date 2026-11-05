# Sistema Calhas Andrade — regras do projeto

App de uso pessoal do Pedro (dono da Calhas Andrade, Araras-SP), usado no **iPhone**, instalado pela
tela de início (PWA). Código em `app/` (React + Vite + Dexie). Requisitos completos em `docs/entrevista.md`.
Respostas ao Pedro: português simples, curtas, direto ao ponto.

## Publicar
- Build: `cd app && BASE_PATH=/app-controle-empresarial/ npx vite build`
- Publica o conteúdo de `app/dist/` (com `.nojekyll`) no branch `gh-pages`.
- Endereço: https://pedroescher01.github.io/app-controle-empresarial/
- O app confere `versao.json` ao abrir/voltar e se atualiza sozinho.

## Erros já corrigidos — NÃO repetir (conferir em toda tela nova)
1. **Barras fixas soltas no iPhone com o teclado.** Nada de novo `position: fixed; bottom: ...`.
   - Barras de baixo (abas, total): escondem com `body.kb` (teclado aberto). Toda barra nova precisa entrar nessa regra.
   - Janelas (Sheet): posicionadas pela área visível `--vv-top` / `--vv-h` e travam a página atrás (`travarPagina`).
   - Avisos (toast) também usam `--vv-*`.
   - Sempre usar o componente `Sheet` para janelas; nunca criar outro modal na mão.
2. **Face ID**: `navigator.credentials.get/create` tem que ser chamado direto no toque, sem `await` antes;
   senão o iPhone mostra a janela "Iniciar Sessão / Usar Chave-senha". Não dá para abrir sozinho ao carregar.
3. **Ícones**: desenhar com cuidado e conferir ampliado. Logos de marcas (WhatsApp) vetorizados do original, nunca à mão.
4. **PDF**: linhas internas da grade finas (0,5pt, cinza escuro) e coordenadas alinhadas; borda externa 0,8pt preta.
   Senão algumas linhas parecem grossas na tela do celular.
5. **Observações do PDF**: "valor à vista" some depois do 1º pagamento (fica salvo no sistema); uma linha por parcela,
   sem linha repetida de "Total pago"; quitado = "orçamento quitado." + selo P.G na última parcela; nunca "1 de 1" com saldo.
6. **Quadro vazio / botão "Adicionar item"** abrem direto a tela de **digitar** item (não a lista).
7. Ler com atenção o que o Pedro pede (ex.: "abrir a tela de digitar" ≠ "abrir a lista"). Na dúvida, perguntar.
8. Formatos sempre certos: moeda R$, teclado numérico em número, telefone com máscara, CPF/CNPJ, endereço separado.

## Checklist antes de publicar qualquer mudança
- `npx tsc -b`, `npx vitest run`, `npx eslint src` sem erros.
- Testar no Playwright com `devices['iPhone 13']`: fluxo da tela, sem erro no console, sem rolagem lateral.
- Conferir se a correção também vale para as outras telas que têm o mesmo componente.
- Depois de publicar: lembrar o Pedro que o app se atualiza sozinho ao abrir.
