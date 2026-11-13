# Sistema Calhas Andrade: resumo técnico completo

Documento para quem for construir a versão para **notebook com impressora**. Descreve o app que já existe
(versão iPhone), as regras de negócio do Pedro e o jeito que ele trabalha. Atualizado em 13/11/2026.

> Fonte de verdade: o código em `app/src` (repositório `pedroescher01/app-controle-empresarial`, branch `planejamento`),
> a entrevista em `docs/entrevista.md` e as regras de erro em `CLAUDE.md`. Este resumo foi tirado deles.

---

## 0. A empresa e o dono

- **Calhas Andrade**: calhas, rufos e pingadeiras em chapa galvanizada. Rua 13 de maio, 874, Centro, Araras/SP.
  CPF/CNPJ 16.693.515/0001-54. Telefones (19) 98959-0119 / (19) 99783-7079. E-mail calhasandradeararas@gmail.com.
  Optante pelo Simples Nacional.
- **Pedro** é quem usa o sistema. Ele fica na fábrica (dobra as peças e cuida do administrativo) e não vai às obras.
- **Dalvo** é o pai do Pedro e o dono da empresa. Ele também é calheiro e trabalha com o **Miguel**.
- Os outros calheiros são terceirizados: Zé Carlos, Marquinhos, Mil, Guilherme etc.
- Cores da marca: **vermelho e branco**. O app tem tema claro e escuro.
- O Pedro quer um sistema com **cara de profissional**, rápido e direto. O que mais irrita ele é sistema simples demais,
  que "parece que eu mesmo fiz".
- Respostas ao Pedro: português simples, curtas, direto ao ponto.

---

## 1. Tecnologia e onde ficam os dados

| Parte | O que é usado |
|---|---|
| App | PWA (site instalado na tela inicial do iPhone). React 18 + TypeScript + Vite |
| Rotas | Hash (`#/orcamento/<id>`, `#/visitas`, `#/bobinas`…) |
| Banco local | **Dexie** (IndexedDB), banco `calhas-andrade`. O iPhone é o banco principal (rápido e funciona sem internet) |
| Memória das telas | `DadosProvider` (`lib/hooks.tsx`): carrega tudo uma vez e as telas leem da memória, sem piscar |
| Nuvem | **Supabase**, projeto `calhas-andrade` (ref `mwaymuqftixvyhwqtrzs`, São Paulo), login com e-mail e senha do Pedro (calhasandradeararas@gmail.com) |
| PDF | **jsPDF** com a fonte Liberation Sans (= Arimo, mesmo desenho) e a logo em `app/public/pdf/` |
| QR do Pix | `qrcode-generator` + gerador próprio do BR Code com CRC16 (`lib/pix.ts`) |
| Avisos no celular | Web Push (VAPID) + Edge Function `supabase/functions/avisos` + pg_cron às 10:30 e 21:30 UTC (7h30 e 18h30 em Brasília) |
| Publicação | GitHub Pages, branch `gh-pages`: https://pedroescher01.github.io/app-controle-empresarial/ |
| Atualização | O app lê `versao.json` ao abrir e ao voltar. Se houver versão nova, recarrega com `?v=` para não pegar cópia velha do cache |
| Testes | vitest (51 testes de regra de negócio) + Playwright simulando iPhone 13 |

### Nuvem (Supabase)
- Tabela única `registros (dono uuid, tabela text, id text, dados jsonb, apagado bool, atualizado_em timestamptz)`, com RLS:
  cada usuário só vê as próprias linhas.
- Cada registro de cada tabela local vira uma linha (`tabela` = nome da tabela, `dados` = o objeto inteiro em JSON).
  A configuração vai como `tabela='config', id='app'`.
- Sincroniza quando algo muda, ao abrir ou voltar para o app, e a cada 5 minutos. Para saber o que mudou, compara uma
  "marca" (hash do JSON) guardada na tabela local `sync`.
- **Nunca vão para a nuvem:** `pinHash`, `pinSalt`, `faceIdCred`, `ultimoBackup`.
- Cadastro de novos usuários **fechado** (`disable_signup: true`). Só existe a conta do Pedro.
- Tabela `push_inscricoes`: guarda as inscrições de aviso do celular.
- **Para a versão notebook:** o caminho mais simples é usar **a mesma tabela `registros`**, com o mesmo login. Assim o
  notebook e o iPhone enxergam os mesmos dados. A chave pública (publishable) e a URL ficam em `app/src/lib/nuvemConfig.ts`.
  **Nunca** colocar a chave secreta (service role) no app.

### Backup
- Mais → Backup: gera um arquivo JSON com todas as tabelas de `TABELAS_DADOS` e permite restaurar a partir dele.
- O Início avisa se não há nuvem ligada e o último backup tem mais de 7 dias.

### Segurança
- **PIN de 6 dígitos**, guardado como hash com sal (o PIN em si não fica salvo em lugar nenhum).
- **Face ID** via WebAuthn (chave-senha do iPhone). O PIN fica de reserva.
- Botão "Bloquear agora" em Mais.

---

## 2. Telas e funções

Barra de baixo: **Início · Visitas · Orçamentos · Financeiro · Mais**.

### 2.1 Início (painel)
- Data de hoje, quanto entrou no mês e quanto foi orçado no mês.
- **Hoje:** visitas e serviços marcados para hoje, com atalho para a agenda.
- **Precisa da sua atenção:**
  - visitas a medir, dizendo há quantos dias espera a mais antiga;
  - orçamentos **sem resposta** (enviados há 5 dias ou mais, sem pagamento), com botão de lembrete no WhatsApp;
  - rascunhos esquecidos;
  - contas vencendo nos próximos 3 dias ou atrasadas;
  - bobinas urgentes ou para comprar;
  - pedido de bobina que chegou e falta pagar;
  - nuvem desligada ou backup atrasado.
- **A receber:** orçamentos aprovados ou pagos em parte que ainda têm saldo, com o total a receber.
- **Últimos orçamentos.**
- Atalhos para criar orçamento, visita etc.

### 2.2 Visitas
Fluxo real do Pedro: o cliente pede visita (WhatsApp, ligação ou na fábrica) e o Pedro anota. Quando um calheiro chega e
pergunta "tem serviço?", o Pedro vê quem falta medir e liga para o cliente para saber se tem alguém no local. O calheiro
vai, mede, anota as peças no papel e volta com o valor da mão de obra. Então o Pedro faz o orçamento.

- Dois estados só: **A medir** e **Medido**.
- Campos: cliente (nome, telefone, endereço; pode salvar como cliente ou deixar "só nesta visita"); **o que precisa ver**
  (atalhos Calha, Rufo, Pingadeira, Condutor, Goteira, Telhado + texto livre); **escada** (Normal / Alta / Muito alta,
  esta normalmente para barracão); data **opcional** com período (manhã/tarde), porque normalmente **não tem data** e a
  visita fica na fila até dar certo; e **quem vai** (calheiro).
- Abas: **A medir** (da mais nova para a mais antiga, mostrando "há X dias", em vermelho a partir de 10 dias), **Medido** e **Agenda**.
- Botões em cada visita:
  - **ligar**;
  - **WhatsApp do cliente**, com mensagem de confirmação pronta ("Vamos passar aí amanhã de manhã para medir. Vai ter alguém no local?");
  - **Calheiros**: manda a visita pronta no WhatsApp de cada calheiro (cliente, telefone, endereço, link do Google Maps,
    o que precisa ver, escada e data combinada). Sem cidade no endereço, assume **Araras - SP**. Tem também a opção
    "Escolher no WhatsApp" (grupo ou outro contato);
  - **Medido**: escolhe quem mediu e pode já **criar o orçamento** com os dados da visita.
- Visitas não guardam medidas nem fotos: as medidas vão direto no orçamento.

### 2.3 Orçamentos (função principal)
- Lista com busca (por nome ou **número**) e filtros por situação.
- **Número aleatório de 4 dígitos que nunca repete** (se acabar, 5 dígitos). Serve para buscar.
- Editor:
  - **Cliente:** busca um cadastrado (e escolhe o endereço, se tiver mais de um), cria rápido (nome e telefone, com
    "Salvar nos clientes" ou "Só neste orçamento") ou digita endereço e fone só para aquele orçamento.
  - **Calheiro(s)** do serviço (um ou mais).
  - **Estilo:** Simples ou Detalhado (veja regras abaixo).
  - **Itens:** atalhos do catálogo (Calha, Rufo, Pingadeira, Calhas e rufos, Chapa, Mão de obra, condutores, acessórios)
    ou item digitado livre. O quadro vazio e o botão "Adicionar item" abrem **direto a tela de digitar**.
  - **Desconto** (R$) e **Fechar em** (total final desejado; veja 3.3).
  - Emitido em, Válido até (padrão **hoje + 15 dias**), **valor à vista** (opcional) e observações.
  - **Serviço agendado** (data e período): aparece na agenda e nos avisos.
  - **Situação:** Rascunho → Enviado → Aprovado (e Recusado, raro).
  - **Pagamentos** (veja 3.5) e **Pix** (QR e copia e cola do valor que falta, para mandar no WhatsApp).
  - **Gerar PDF:** prévia, depois **dois passos**: (1) abrir a conversa do cliente pelo número (funciona sem o número
    estar salvo), com mensagem pronta; (2) compartilhar o PDF (a conversa dele aparece primeiro na lista do WhatsApp).
    Ao enviar, um rascunho passa para "Enviado".
  - **Lembrete** no WhatsApp para orçamento sem resposta.
- **Juntar orçamentos** (uso raro): veja 3.6.
- **Material adiantado do calheiro:** quando o orçamento tem calheiro que levou material adiantado, o app sugere
  descontar (veja 3.7).

### 2.4 Clientes
- Nome, tipo (pessoa física ou empresa), CPF/CNPJ **opcional** com máscara, telefone e telefone 2 com máscara
  `(19) 98959-0119`, **vários endereços** (logradouro, número, complemento, bairro, cidade, UF; cidade padrão Araras)
  e observações.
- Botões de WhatsApp, ligar e Google Maps.
- **Histórico:** todos os orçamentos do cliente.
- Pode existir orçamento sem cliente salvo (só o nome, ou "balcão").

### 2.5 Calheiros (Mais → Calheiros)
- Nome, telefone e ativo/inativo.
- Página de cada calheiro: **serviços** (orçamentos com ele), **material adiantado** (saldo) e **histórico do material**.
- O app **não** controla "a pagar ao calheiro" (o Pedro disse que não precisa).

### 2.6 Financeiro
- **Mês a mês:** entrou, taxas da maquininha, saiu e **sobrou**. Gráfico dos últimos 6 meses.
- **Lançamentos** (entradas e saídas) com data, valor, descrição, categoria, forma e conta.
  - Categorias de **entrada:** Orçamento, Venda no balcão, Outros.
  - Categorias de **saída:** Fornecedor, Calheiro, Combustível, Aluguel, Impostos, Contas (luz, água, internet),
    Ferramentas, Alimentação, Manutenção, Retirada do Pedro, Outros.
  - Formas: Pix, Dinheiro, Cartão de crédito, Cartão de débito, Transferência, Boleto, Cheque (+ "Direto ao calheiro").
  - Contas: **Sicoob** (principal), **InfinitePay** (maquininha; o dinheiro depois vai para o Sicoob) e **Caixa (dinheiro)**.
    Conta padrão por forma: cartão → InfinitePay, dinheiro → Caixa, o resto → Sicoob.
- **Para onde foi o dinheiro:** saídas por categoria.
- **Contas a pagar** (contas fixas):
  - repetem **mensal** (dia do mês; se o mês não tem o dia, usa o último), **semanal** (dia da semana) ou **única**
    (boleto com vencimento);
  - valor de sempre, que pode mudar na hora de pagar (ex.: conta de luz);
  - pagar gera uma saída ligada à conta e ao vencimento (`contaFixaId` + `referencia`);
  - mostra as atrasadas, inclusive as do mês anterior que ficaram em aberto;
  - só conta a partir do mês em que foi cadastrada.
  - Exemplos do Pedro: aluguel do barracão, aluguel da máquina, DAS/impostos, internet, **retirada do Pedro de R$ 500 toda sexta**.
- **Calculadora da maquininha:** quanto cai de verdade e **quanto cobrar para receber o valor cheio** (veja 3.8).
- **Relatórios em PDF (A4):** do mês e do ano, com a mesma logo e fonte do orçamento.
- Contas **a receber** = saldo dos orçamentos (no Início e na lista de orçamentos).

### 2.7 Bobinas, fornecedores e pedidos (Mais → Bobinas e pedidos)
Veja a seção 4.

### 2.8 Mais (ajustes)
- Clientes, Calheiros, Bobinas e pedidos, Fornecedores, Contas fixas e maquininha.
- **Tabela de preços** (fica escondida aqui porque o uso é raro): preço do metro, fator da chapa 24 e preço de cada item do catálogo.
- **Dados no PDF:** e-mail do cabeçalho e validade em dias.
- **Pix para cobrança:** chave, nome e cidade, e se o QR aparece no PDF. O Pedro decidiu: **Pix só pelo WhatsApp, não no PDF**.
- Nuvem, Avisos no celular (resumo às 7h30 e às 18h30), Backup, Aparência (Automático/Claro/Escuro), Face ID, Trocar PIN,
  Bloquear agora e a versão do app.

### 2.9 Avisos no celular (push)
- **7h30:** o que tem para hoje (visitas com data, serviços, contas que vencem), contas atrasadas (até 31 dias),
  quantas visitas a medir e há quantos dias está a mais antiga, orçamentos sem resposta há 5 dias ou mais, e pedido de
  bobina que chegou e falta pagar.
- **18h30:** o que tem para amanhã (visitas, serviços e contas que vencem).

---

## 3. Regras de negócio dos orçamentos

### 3.1 Catálogo e preços atuais (editáveis em Mais → Tabela de preços)

| Item | Tipo | Unid. | Preço |
|---|---|---|---|
| Calha | metro | m | pelo corte (padrão 33 cm) |
| Rufo | metro | m | pelo corte (padrão 25 cm) |
| Pingadeira | metro | m | pelo corte (padrão 20 cm) |
| Calhas e rufos | metro | m | sem corte: valor digitado ou "Fechar em" |
| Chapa | metro | m | pelo corte (padrão 120 cm) |
| Mão de obra | mão de obra | un | valor digitado (quantidade 1) |
| Condutor quadrado 25 / 28 / 33 | unidade | m | R$ 25,00 o metro (barra de 2 m = R$ 50,00) |
| Condutor redondo 3" | unidade | m | R$ 30,00 o metro (barra de 2 m = R$ 60,00) |
| Bocal 2" / 3" / 4" | unidade | un | R$ 10,00 |
| Suporte para calha (moldura) | unidade | un | R$ 15,00 |
| Par de curva | unidade | par | R$ 75,00 |
| Silicone | unidade | un | R$ 35,00 |
| Estanho | unidade | un | R$ 35,00 |
| Brocante | unidade | un | R$ 0,30 |
| Bucha 6 / Bucha 8 | unidade | un | R$ 0,30 |
| Rebite (arrebite) | unidade | un | R$ 0,30 |
| Tampa | não entra no orçamento (já faz parte da mão de obra) | | |

- Unidades disponíveis: m, un, par, barra, kg, cx.
- **Condutor** é digitado em **metros**. O app mostra quantas **barras de 2 m** dá (ex.: 6 m = 3 barras).
- Vocabulário do Pedro: **"cocho" = calha** e **"pingadeira" ≈ rufo**. Usar o termo que ele falar.

### 3.2 Preço de calha, rufo e chapa (pelo corte)
```
preço do metro do item = (corte em cm ÷ 100) × preço do metro × fator da chapa
total da linha         = metragem × preço do metro do item
```
- **Preço do metro: R$ 60** (padrão; historicamente ele usava 60 ou 65; dá para mudar em Configurações).
- **Chapa 26** (0,47 mm, padrão): fator 1. **Chapa 24** (0,60 mm): **50% mais cara** (fator 1,5).
- Exemplo: calha corte 33, 10 m, chapa 26 → 0,33 × 60 × 10 = **R$ 198,00**.
- **Cortes de orçamento:** 10, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 45, 50, 55, 60, 65 e, **de 70 a 115 de 5 em 5**, e 120.
  Os de 70 a 115 saem da bobina de 120, mas **o cliente paga só a largura usada**. A sobra é aproveitada depois
  (tirou 80, sobram 40). O app **não controla as sobras**.
- O item pode ter **preço manual** (o Pedro digita o valor por metro) em vez do cálculo pelo corte.
- **Arredondamento:** sempre para 2 casas (centavos), em cada passo: preço unitário, total da linha, subtotal e total.

### 3.3 "Fechar em" (ajustar para bater o total que o Pedro quer)
Regra antiga do Pedro, que continua valendo:
- A diferença entre a soma dos itens e o total desejado é **dividida igualmente entre os itens por metro**
  (calhas, rufos, pingadeiras, chapa).
- **Nunca** entra em item por unidade (bocal, silicone, brocante, bucha), **nunca** no condutor e **nunca** na mão de obra.
- O total tem que bater **até o centavo**. O algoritmo trabalha em centavos: divide a diferença pelo número de itens por
  metro, e o resto (1 centavo de cada vez) vai para os primeiros itens.
- Com desconto, o alvo do subtotal é o "Fechar em" **mais** o desconto.
- Depois do ajuste, o unitário mostrado é total ÷ metragem, arredondado.
- Se não há nenhum item por metro, o ajuste é impossível e o app avisa. Na prática, aí o Pedro põe o valor na mão de
  obra (ex.: orçamento só de bocais e silicones).

### 3.4 Simples x Detalhado
- **Simples (o mais comum):** cada linha mostra só Quant., Unid. e Descrição. **Unitário e Total da linha ficam em branco
  no PDF.** Só aparecem Subtotal, Desconto e Total. Ex.: "42 | m | Rufos", "1 | un | Mão de obra".
  Calha e rufo numa linha, cada acessório na sua própria linha.
  - Jeito comum de lançar: itens por metro com preço 0, acessórios com o preço de catálogo, mão de obra 0 (ou com valor)
    e **"Fechar em" = total combinado**. Assim a diferença cai nos metros e o total bate.
- **Detalhado:** cada linha com unitário e total (quando o cliente pede).
- **Mão de obra sempre entra como item próprio** (para mostrar que está inclusa). Nunca vai nas observações.
- Nada de linhas de categoria ("Material", "Mão de obra") na tabela.
- **Acréscimo nunca aparece para o cliente.** Ajustes são só internos (é o "Fechar em").
- Custo e lucro: o Pedro **não** quer controlar.

### 3.5 Situação, pagamentos e quitação
- **Situação do orçamento:** Rascunho → Enviado → Aprovado (Recusado existe, mas é raro: o cliente simplesmente some).
- **Situação mostrada nas listas** (em ordem de prioridade):
  - **Juntado:** entrou em outro orçamento.
  - **Quitado:** pagou tudo.
  - **Pago em parte:** tem pagamento e ainda falta.
  - **A receber:** aprovado sem pagamento.
  - **Vencido:** enviado, e a validade passou.
  - **Aguardando:** enviado dentro da validade.
  - **Rascunho** / **Recusado.**
- **Sem resposta:** enviado há **5 dias ou mais** sem pagamento. Aparece no Início e nos avisos, com lembrete no WhatsApp.
- **Registrar pagamento:** data, valor, forma, conta, em quantas parcelas (1 a 12) e dados do cartão (maquininha ou link,
  bandeira, parcelas).
  - O orçamento passa para **Aprovado** sozinho.
  - Vira **entrada no Financeiro** sozinho (categoria "Orçamento", ligado por `orcamentoId` e `pagamentoId`), já com a
    **taxa da maquininha** descontada quando é cartão.
  - Total de parcelas = máximo entre o escolhido e (pagamentos feitos + 1, se ainda falta).
  - **"Direto ao calheiro":** quando o cliente paga a mão de obra direto ao calheiro, entra no orçamento mas **não** entra
    no financeiro (o dinheiro não passou pela empresa). No PDF aparece "(direto ao Marquinhos)".
- **Parcelamento:** cliente de confiança pode parcelar de qualquer jeito (Pix com datas combinadas, ou sem data: ele vem
  acertar uma vez por mês). Quem não é de confiança só parcela **no cartão**.
- **Nome do arquivo:** `Orçamento 364 - Edgar.pdf`. Quitado: `Orçamento 364 - Edgar - PAGO.pdf`. Não marcar parcial no nome
  e não pôr o calheiro.

### 3.6 Juntar orçamentos
- Só do mesmo cliente, sem pagamento, não recusados e não juntados.
- O novo orçamento é emitido **hoje**:
  - **soma as metragens numa linha só**, "Calhas e rufos" (com o valor somado);
  - soma os acessórios iguais;
  - soma a mão de obra numa linha;
  - soma os descontos;
  - junta os calheiros.
- O total do novo é a **soma dos totais**, até o centavo.
- Observação automática: "Este orçamento reúne 3 orçamentos: nº 1234 (02/11/2026), nº 5678 (04/11/2026) e nº 9012 (06/11/2026)."
  Usa a data do serviço, ou a de emissão se não houver.
- Os antigos ficam como **Juntado**. Dá para **separar de novo**: apaga o novo e libera os antigos.

### 3.7 Material adiantado do calheiro
Caso real: o Zé Carlos pegou 4 silicones para deixar no carro.
- Registra quanto ele pegou (data e item) na página do calheiro.
- Quando ele faz um serviço com a gente e pede material, o app mostra o saldo e **sugere descontar** do que ele já pegou:
  aquele material não é entregue de novo.
- O saldo de cada material é a soma dos movimentos (positivo = pegou, negativo = descontado num orçamento).

### 3.8 Taxas da maquininha (InfinitePay, tabela enviada pelo Pedro em 06/11/2026)

| Maquininha | Débito | Crédito 1x … 12x |
|---|---|---|
| Visa/Master | 1,37% | 3,15 · 5,39 · 6,12 · 6,85 · 7,57 · 8,28 · 8,99 · 9,69 · 10,38 · 11,06 · 11,74 · 12,40 |
| Elo | 2,58% | 4,91 · 6,47 · 7,20 · 7,92 · 8,63 · 9,33 · 10,03 · 10,72 · 11,41 · 12,08 · 12,75 · 13,41 |
| Amex/Hiper | não tem | igual à Elo |
| **Link de pagamento** (crédito) | não tem | 4,20 · 6,09 · 7,01 · 7,91 · 8,80 · 9,67 · 12,59 · 13,42 · 14,25 · 15,06 · 15,87 · 16,66 |

- Taxa em R$ = valor × % (arredondado em centavos). O financeiro guarda o valor bruto e a taxa: líquido = valor − taxa.
- **Quanto cobrar para receber o valor cheio** = valor ÷ (1 − taxa), arredondado **para cima** no centavo.
- A tabela fica na configuração e dá para atualizar sem mexer no código.

### 3.9 Pix de cobrança
- Gera o **BR Code** (copia e cola) e o QR com o valor que falta, a chave, o nome e a cidade do Pedro (configurados em
  Mais → Pix). O txid é `ORC<número>`.
- Mostra na tela para mandar pelo **WhatsApp**. **Não** vai no PDF (decisão do Pedro).
- **Sem baixa automática:** o Pedro avisa quando o cliente pagou e o pagamento é lançado.

---

## 4. Estoque de bobinas, fornecedores e pedidos

### 4.1 Como funciona o estoque
- Tudo **galvanizado**, sem cores. Duas espessuras: **chapa 26** (0,47 mm, padrão) e **chapa 24** (0,60 mm). A chapa 28 nunca
  é usada e não é cadastrada.
- **Cortes de bobina (cm):** 10, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 45, 50, 55, 60, 65 e 120 (corte inteiro).
  São 17 cortes × 2 chapas.
- **Regra do Pedro: existem 2 bobinas de cada corte**, uma na **produção** e uma no **estoque**. Quando a do estoque vai
  para a produção, tem que comprar outra.
- **Sem baixa automática por metro e sem previsão de fim pelo sistema:** isso é impreciso. O controle é visual:
  - **Tem no estoque?** Sim (`ok`) ou Não (`comprar`).
  - **Quanto resta na da produção:** **Bastante, Médio, Afinando ou Acabando.**
  - **Pedida:** derivado, quando a bobina está num pedido já mandado que ainda não chegou.
- **Conferência** (o Pedro faz, por exemplo, sexta no fim do expediente): toca no corte e marca estoque e nível.
- **Desenho na grade:** cada corte mostra **duas bobinas** (rolo deitado, de aço, com furo). A 1ª é a do estoque (cheia =
  tem; tracejada = não tem). A 2ª é a da produção e vai **afinando**: cheia em Bastante, mais fina em Médio e Afinando,
  meia em Acabando. O furo fica do mesmo tamanho.
- **Prioridade de compra** (cor do quadradinho):
  - **Urgente** (vermelho cheio): não tem no estoque **e** a da produção está afinando ou acabando.
  - **Repor** (vermelho claro): não tem no estoque, mas a da produção ainda tem bastante ou médio.
  - **De olho** (amarelo): tem no estoque, mas a da produção está acabando (logo vai abrir a do estoque).
  - **Pedida** (azul): já está num pedido mandado.
  - **Ok.**
- Botões **"Pedido só dos urgentes"** e **"Pedido de tudo que falta"**.
- **Jogada importante:** antes de mandar um pedido, o Pedro confere com o pai. Já pediu para não montar pedido sem falar
  com ele (houve um caso de golpe envolvendo dinheiro). Não mandar pedido sozinho.

### 4.2 Fornecedores
- Nome, CNPJ, nome do vendedor e telefone do vendedor. Só isso.
- O Pedro disse que compra hoje da **Galvisa (Leme)**, a mais barata. As notas que ele mandou vêm com o cabeçalho **GVS**,
  e no sistema o fornecedor foi cadastrado como **"GVS"**. Confirmar com o Pedro se é a mesma empresa (provável) e o nome
  do vendedor.

### 4.3 Pedido de compra (etapas)
1. **A pedir:** montado com as bobinas marcadas. Dá para somar e tirar quantidade.
2. **Pedido:** mensagem pronta no WhatsApp do vendedor, ou "já mandei de outro jeito". Texto da mensagem:
   ```
   Olá, Rafael! Aqui é o Pedro, da Calhas Andrade (Araras).
   Gostaria de fazer um pedido de bobinas galvanizadas:

   • 2 bobinas corte 33 · chapa 26 (0,47 mm)
   • 1 bobina corte 50 · chapa 24 (0,60 mm)

   Quando fechar a carga, me avisa e manda a nota, por favor. Obrigado!
   ```
   (chapa 26 antes da 24, cortes em ordem crescente)
3. **Nota do fornecedor:** o valor só é conhecido quando chega a nota. Registra: valor total, data, **peso de cada bobina**
   (o peso total soma sozinho) e **preço do kg** de cada chapa (dá para calcular valor ÷ peso).
4. **Chegou:** as bobinas do pedido voltam a ter **no estoque** (o nível da produção não muda).
5. **Pago:** vira **saída no financeiro** (categoria Fornecedor). O Pedro **sempre paga no Pix, no dia da entrega**, à vista
   (não existe pagamento parcial).
- **PDF do pedido** para guardar.
- O fornecedor espera fechar a carga do caminhão, avisa (geralmente um dia antes, mas varia) e manda a nota.

### 4.4 Compra por quilo, preço médio e peso
- A nota vem **por kg**. Exemplo de linha da GVS: `BZN-CORTE-I 0.47-CH 26/33 · Peças 1 · 155 KG · 6,80 · 1.054,00`.
  "CH 26/33" = chapa 26, corte 33. **"Peças 2" = 2 bobinas** (a nota traz só o peso das duas juntas).
- **Histórico do preço do kg** por chapa, com gráfico, ordenado por data com desempate pelo número do pedido. Mostra a
  variação do último preço contra o anterior ("subiu 4,35%" / "caiu …").
- **Peso médio por corte:** média, menor e maior peso já recebidos e quantas bobinas entram na conta.
- **Aviso de bobina fora do normal:** mais de **10%** acima ou abaixo da média do corte ("Veio leve: 18% abaixo da média (305 kg)").
- **Previsão do pedido:** peso ≈ soma do peso médio de cada corte × quantidade. Valor ≈ peso × **último preço do kg** da
  chapa. Corte sem histórico é estimado **pela largura**: média de kg por cm das bobinas da mesma chapa × corte.
- **Histórico já lançado:** 14 notas da GVS de 07/01/2026 a 23/10/2026 (pedidos nº 1 a 14, concluídos, **sem** lançar no
  financeiro). Nas notas com 2 peças, o peso foi dividido meio a meio. O nº 11 (24/08/2026) foi a reposição geral:
  8 bobinas, 1.397 kg, R$ 10.477,50.
  - Preço do kg da chapa 26: R$ 6,70 (jan) → R$ 8,80 (fev/mar) → R$ 6,80 (out).
  - Peso médio da chapa 26 (kg): 10 = 47, 15 = 61, 22 = 102, 25 = 121, 28 = 137, 30 = 105, 33 = 152, 35 = 163, 40 = 158
    (varia muito: 123–194), 45 = 208, 50 = 222, 55 = 254, 60 = 282, 120 = 262. Chapa 24, corte 120 = 261.

---

## 5. PDF do orçamento (layout oficial)

Réplica do modelo "nota fiscal quadriculada" (referência: "Orçamento 364 - Edgar"). **Papel A5 retrato**
(419,528 × 595,276 pt), **margem de 18 pt**, impresso em A5. Fonte **sempre Arimo / Liberation Sans** (nunca Helvetica),
corpo de 9,6 pt. Arquivo de referência: `app/src/lib/pdf.ts` (todas as medidas estão lá).

De cima para baixo:
1. **Cabeçalho** (caixa de 100,3 pt de altura): logo completa à esquerda (≈ 80 × 75 pt). Centralizado à direita:
   "Calhas Andrade" (negrito, 14,3 pt), depois CPF/CNPJ, endereço, telefones e e-mail.
2. **Faixa** com 3 células: `Orçamento nº: 364` | `Emitido em: 05/11/2026` | `Válido até: 20/11/2026`.
3. **Caixa do cliente** com 3 linhas: `Cliente:` | `Endereço:` | `Fone:` ("Não informado" se vazio).
   - O cliente leva o calheiro entre parênteses: **"Edgar - (Zé Carlos)"**, "Gecionete França - (Dalvo e Miguel)".
   - **Sem calheiro, repete o cliente:** "Ivan - (Ivan)".
4. **Tabela de itens:** colunas `Quant. | Unid. | Descrição | Unitário | Total`, cabeçalho **cinza** (RGB 239), linhas de
   15 pt, **mínimo de 8 linhas** (cresce se tiver mais). No modo simples, Unitário e Total ficam em branco.
5. **Subtotal | Desconto | Total** (3 colunas, cabeçalho cinza). **Sem acréscimo.**
6. **OBSERVAÇÕES** (título em negrito centralizado; a caixa cresce com o texto). Linhas automáticas, nesta ordem:
   - "Em caso de pagamento à vista, o valor será R$ 800,00." **Só enquanto não houver pagamento.** Depois do 1º pagamento
     some do PDF, mas fica salvo no sistema. Nunca escrever "Pagamento à vista: R$ …", que parece pago.
   - As observações digitadas.
   - **Uma linha por parcela paga:**
     `Parcela 1 de 3 - paga em 06/11/2026 - R$ 500,00 (Pix) - falta R$ 1.000,00`
     - Na última, se quitou: `… - orçamento quitado.` + **selo "P.G" vermelho circulado**, pequeno e discreto, ao lado.
     - "orçamento quitado." nunca quebra no meio da linha, e sempre sobra espaço para o selo.
     - Se ainda falta pagar, **nunca** escrever "1 de 1": sempre há pelo menos mais uma parcela.
     - Sem linha repetida de "total pago".
   - Formas no PDF: "(Pix)", "(dinheiro)", "(cartão de crédito)", "(direto ao Marquinhos)".
   - Tudo na mesma fonte e tamanho, preto, sem destaque.
   - (Opcional, hoje desligado: QR do Pix do valor que falta à direita das observações.)
7. **Duas linhas de assinatura:** "Calhas Andrade" e o nome do cliente (nome longo diminui a letra até 7,5 pt antes de cortar).
   Se não couber, vai para uma 2ª página.

**Detalhes de traço (o Pedro reparou e pediu):**
- Borda externa 0,8 pt preta.
- **Linhas internas da grade finas: 0,5 pt, cinza bem escuro (RGB 70).**
- Coordenadas alinhadas a 1 pt, senão algumas linhas parecem grossas na tela.
- Texto que não cabe na célula é cortado com "…".

**Relatórios do financeiro:** PDF **A4**, com a mesma logo e fonte (mês e ano: entradas, saídas, taxas, sobrou e por categoria).

**Para a versão com impressora:** imprimir o orçamento em **A5** (é o papel em que o Pedro imprime). Relatórios em A4.

---

## 6. Estrutura de dados (tabelas e campos)

Todas as datas são `AAAA-MM-DD` (texto). "Carimbos" (`criadoEm`, `atualizadoEm`) são ISO com hora. Ids são UUID.
Valores em reais (número com 2 casas).

**clientes:** `id, nome, tipo('pf'|'pj'), documento, telefone, telefone2, enderecos[{id, logradouro, numero, complemento, bairro, cidade, uf}], observacoes, criadoEm, atualizadoEm`

**calheiros:** `id, nome, telefone, ativo, criadoEm`

**orcamentos:**
```
id, numero (único), clienteId|null, clienteNome, telefone, endereco (texto pronto),
calheiroIds[], modo('simples'|'detalhado'),
itens[{ id, tipo('metro'|'unidade'|'mao'), catalogo?, descricao, unidade, quantidade,
        corte?(cm)|null, chapa?(24|26), precoUnit, precoManual?, condutor? }],
desconto, totalDesejado|null ("Fechar em"), valorAVista|null, observacoes,
status('rascunho'|'enviado'|'aprovado'|'recusado'),
emitidoEm, validoAte|null, enviadoEm|null, aprovadoEm|null,
parcelas, pagamentos[{ id, data, valor, forma, conta, cartao?{meio,bandeira,parcelas} }],
servicoData?|null, servicoPeriodo?('manha'|'tarde')|null, juntadoNo?|null, criadoEm, atualizadoEm
```
- Endereço do orçamento em texto: "Rua X, 151 - Bairro". A cidade só entra se não for Araras (e "/UF" se não for SP).
- **No "pagamento direto ao calheiro", `forma = 'Direto ao calheiro'` e `conta` = nome do calheiro.**

**lancamentos:** `id, tipo('entrada'|'saida'), data, valor, descricao, categoria, forma, conta, orcamentoId?, pagamentoId?, taxa?, contaFixaId?, referencia?(vencimento), pedidoId?, cartao?, criadoEm`
- **Regra:** todo pagamento dentro de `orcamentos.pagamentos` precisa ter o lançamento correspondente (exceto "Direto ao
  calheiro"). Já aconteceu de um pagamento lançado direto no banco não aparecer no financeiro.

**visitas:** `id, clienteId|null, nome, telefone, endereco, precisa[], detalhe, escada('normal'|'alta'|'muito_alta'), status('a_medir'|'medido'), data|null, periodo|null, calheiroId|null, medidoEm|null, orcamentoId|null, criadoEm, atualizadoEm`

**contasFixas:** `id, descricao, categoria, valor, repete('mensal'|'semanal'|'unica'), dia (dia do mês 1–31 ou dia da semana 0=domingo), vencimento|null (só única), ativa, criadoEm`

**bobinas:** `id ("26-33"), corte, chapa, estado('ok'|'comprar'), producao?('bastante'|'medio'|'afinando'|'acabando'), atualizadoEm`
(bobina sem registro = ok e bastante)

**fornecedores:** `id, nome, cnpj, vendedor, telefone, criadoEm`

**pedidos:** `id, numero (sequencial), fornecedorId|null, itens[{corte, chapa, quantidade, pesos?[] (kg de cada bobina)}], observacoes, pedidoEm|null, notaEm|null, chegouEm|null, pagoEm|null, valorTotal|null, pesoKg|null, precoKg26|null, precoKg24|null, formaPagamento, contaPagamento, criadoEm, atualizadoEm`

**adiantamentos:** `id, calheiroId, chave (catálogo, ex. "silicone", ou "desc:<descrição>"), descricao, quantidade (+ pegou / − descontado), data, orcamentoId|null, criadoEm`

**config** (um registro só, `key='app'`):
`precoMetro (60), fatorChapa24 (1,5), validadeDias (15), email, precos{chave→preço}, tema, pixChave, pixNome, pixCidade ('Araras'), pixNoPdf (false), taxasCartao (tabela 3.8), taxaCredito/taxaDebito (antigos)`.
Fica só no aparelho: `pinHash, pinSalt, faceIdCred, ultimoBackup`.

Na nuvem: `registros(dono, tabela, id, dados, apagado, atualizado_em)` com `tabela` ∈ as de cima + `config`.

---

## 7. Jogadas, exceções e o jeito de trabalhar do Pedro

- **Velocidade acima de tudo:** é tudo corrido. Teclado numérico em número, máscara de telefone, CPF/CNPJ e moeda (R$),
  endereço separado em campos.
- **Visitas sem data:** a maioria fica na fila "sem previsão". Antes de mandar o calheiro, **liga para o cliente** para ver
  se tem alguém lá. Visita não é cobrada. Já chegou a 5 visitas por dia.
- **Calheiro que também é cliente:** Guilherme e Mil pegam material no nome deles. Às vezes o calheiro pega material para um
  cliente que nem se sabe quem é, ou para ele mesmo. O orçamento leva o **nome do cliente final só para identificar** e o
  calheiro como responsável, sem salvar esse cliente (ex.: "Vanderlei", do Zé Carlos).
- **Pagamento dos calheiros:** pelo valor da mão de obra do orçamento, **toda sexta-feira**.
  - Dalvo e Miguel dividem entre eles (o Dalvo às vezes pega mais, porque cuida do carro e do combustível; ele diz quanto
    dar ao Miguel).
  - Terceirizado leva a mão de obra inteira, salvo desconto combinado. Paga em Pix ou dinheiro.
- **Cliente paga a mão de obra direto ao calheiro** (ex.: Leonardo com o Marquinhos): só o material entra para a empresa.
  Use a forma "Direto ao calheiro".
- **Desconto que não fica quebrado:** no orçamento do Leonardo (5490), o Pedro deu **5% de desconto no material**
  (R$ 1.300 → R$ 1.235) e **arredondou para baixo mais R$ 5** para fechar em R$ 1.230. Com a mão de obra de R$ 1.100,
  o total ficou R$ 2.330 (desconto total de R$ 70). **Não é uma margem fixa:** foi negociação daquele cliente.
  O hábito é arredondar para um valor redondo.
- **Pedir adiantamento ao cliente** quando precisa pagar o calheiro na sexta: o Pedro manda mensagem educada pedindo pelo
  menos uma parte. Só lança a entrada quando o cliente paga.
- **Cobrar sem ser chato:** mensagem gentil de lembrete ("às vezes ele só esqueceu de responder; dá para ganhar uma venda com isso").
- **Pix só pelo WhatsApp**, nunca no PDF. Sem baixa automática.
- **Venda no balcão** (ex.: Darli, R$ 190 por 6 m de rufo, 2 silicones e 50 brocantes): só uma entrada no financeiro, sem orçamento.
- **Orçamento antigo de fora do sistema** (ex.: Gecionete França, R$ 500): só registra a entrada.
- **Material adiantado** (Zé Carlos e os 4 silicones): fica no carro e vai sendo descontado nos serviços.
- **Garantia** existe, mas não aparece no orçamento.
- **Sem pasta no Google Drive** e sem planilha: tudo no sistema.
- **Alimentação** do Pedro e do Dalvo sai da empresa (categoria Alimentação). O Pedro retira **R$ 500 toda sexta**
  (o dono é o Dalvo).
- Contas: dinheiro da maquininha cai na InfinitePay e depois o Pedro passa para o Sicoob.

### Erros que já aconteceram e não podem se repetir (servem para qualquer versão)
1. Valor do orçamento ou tela "solta" com o teclado do iPhone: barras fixas somem quando o teclado abre. As janelas que
   sobem de baixo ficam soltas e o conteúdo delas rola.
2. Tela piscando ao trocar de página: dados vêm da memória, não do banco a cada tela.
3. Ícone do WhatsApp desenhado à mão ficou errado: logos de marca sempre vetorizados do original.
4. Linhas do PDF grossas: grade interna fina (0,5 pt cinza escuro) e alinhada.
5. "Fechar em" nunca mexe em acessório, condutor ou mão de obra.
6. Ordenar por data **sempre com desempate** (duas notas no mesmo dia já inverteram "subiu" e "caiu").
7. Criar o registro completo numa gravação só (criar vazio e completar depois abriu um orçamento em branco).
8. Tela aberta não pode regravar por cima de uma mudança feita em outro aparelho ou direto na nuvem.
9. Pagamento sem lançamento não aparece no financeiro (caso Marcelo).
10. Publicou e não conferiu: a publicação no GitHub falhou e o celular ficou na versão velha. **Sempre conferir a publicação.**
11. Número de orçamento repetido (houve um nº 362 repetido antes do sistema): o número é único.

---

## 8. O que ficou pendente ou o Pedro queria melhorar

**Dados a confirmar ou lançar** (situação em 06/11/2026; o Pedro pode ter resolvido algum pelo celular depois):
- **Mil** (orçamento 8267, R$ 130): pagou R$ 100 em dinheiro e ficou de pagar **R$ 30 na segunda, 09/11**. Conferir se pagou.
- **Leonardo** (5490, R$ 2.330, aprovado): material R$ 1.230 para a empresa. A mão de obra pode ser paga direto ao Marquinhos. Nada pago ainda.
- **Marcelo** (3185, R$ 840): lançado como **Pix** sem confirmação da forma.
- **Gecionete França** (R$ 500): lançado como Pix; confirmar a forma.
- **Zé Carlos:** saldo de 4 silicones adiantados. Ainda não se sabe se vai descontar no orçamento do Vanderlei.
- **Entrada "Calheiro Mil" de R$ 500 em dinheiro** no financeiro (06/11): não foi lançada pelo assistente. Confirmar com o Pedro.
- **Pedido nº 15** (cortes 28 e 30, mandado em 06/11) está **sem fornecedor** (escolher GVS) e sem nota.
- **Conferência da chapa 24** nunca foi feita (só a chapa 26 foi conferida).
- Orçamentos da Jussara (9634) e do Alex Vicente (6446): **"Bucha" sem tamanho** (6 ou 8). Chico Lemos (5531): "Bocal para
  corrente" com preço de referência R$ 10. Os três estão em rascunho, com Dalvo e Miguel.
- Nome do fornecedor: **GVS x Galvisa** e o vendedor.

**Coisas que o Pedro queria ou podem melhorar:**
- Ver se o link do WhatsApp abre o **WhatsApp Business** (é o que ele usa) e não o normal.
- **Áudio / IA dentro do app:** "talvez no futuro".
- **Versão para notebook com impressora** (este documento): imprimir orçamento em A5, relatórios em A4, mesmos dados.
- Agenda de serviços com aviso (já existe; o Pedro disse que é raro, mas útil quando o Dalvo agenda).
- Controle das **sobras** dos cortes de 70 a 115 (hoje não existe; o Pedro não pediu, só explicou que a sobra é aproveitada).
- Tokens de administração do Supabase usados na configuração: já não funcionam mais (em 13/11/2026). Para mexer no banco pela API de novo, gerar um token novo e apagar depois.

**O que o Pedro disse que NÃO quer:** custo e lucro por orçamento, metas, contador, fotos de visita ou comprovante,
duplicar orçamento, baixa automática de estoque por metro, alerta automático de fim de bobina, rota ou mapa para os
calheiros (eles não usam o app), origem do cliente, importar clientes ou orçamentos antigos, pasta no Drive.
