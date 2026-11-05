# Entrevista – Sistema Calhas Andrade

Respostas do Pedro, guardadas aqui para não se perderem. Atualizado a cada rodada.

## Rodada 1 – Perguntas 1 a 35 (respondidas em 05/11/2026)

### A. Uso geral e tecnologia
1. **Aparelho:** iPhone. Por enquanto só no celular.
2. **Formato:** app pelo navegador (com ícone na tela inicial) — aprovado.
3. **Offline:** não precisa.
4. **Acesso:** PIN (6 dígitos, definido pelo Pedro — não registrado aqui por segurança).
5. **Dados:** na nuvem. Prioridade máxima: NÃO PODE PERDER DADOS.
6. **Custo:** começar sem pagar banco de dados; se não der, procurar um.
7. **Usuários:** só o Pedro.
8. **Tema:** claro e escuro.
9. **Referências visuais:** nenhuma ainda (talvez Pinterest depois).
10. **O que irrita:** sistema simples demais, "parece que eu mesmo fiz", feio. Quer nível profissional de verdade.
11. **Tela inicial:** sim, dashboard.
12. **Orçamento pelo app:** sim, mas tem que ser rápido e fácil no celular — ajudar, não atrapalhar. Claude no chat pode continuar existindo.
13. **Áudio/IA:** não agora; talvez no futuro.

### B. Clientes
14. **Dados:** nome, telefone, endereço, observações (livre). Sem CPF/CNPJ/e-mail obrigatórios.
    - **Regra geral do sistema:** todo campo no formato certo e com teclado certo:
      moeda em R$, teclado numérico para números, telefone com máscara `(19) 98959-0119`,
      CPF/CNPJ com máscara, endereço separado em logradouro / número / bairro / cidade / UF.
15. **Vários endereços:** raro, mas acontece. Ideia: cliente pode ter mais de um endereço e o orçamento escolhe qual usar.
16. **Tipo:** pessoa física ou empresa (CPF ou CNPJ, opcional).
17. **Calheiro/balcão:** existe cliente calheiro; às vezes o calheiro pega material para um cliente que nem sabemos quem é, ou para ele mesmo. Às vezes nem o nome se sabe. → Precisa permitir venda/orçamento com cliente mínimo (só nome, ou "balcão").
18. **Histórico do cliente:** sim (o que já fizemos para ele).
19. **Botões WhatsApp / Maps:** sim. Velocidade é essencial.
20. **Origem do cliente:** não precisa.
21. **Clientes antigos:** não importar. Começar do zero.

### C. Visitas
22. **Fluxo real:** cliente pede visita (WhatsApp, ligação ou na fábrica) → Pedro anota dados e o problema → quando um calheiro chega e pergunta "tem serviço?", Pedro vê quem ainda não foi medido → liga para o cliente para ver se tem alguém no local → calheiro vai, mede, anota peças/acessórios no papel → volta, entrega o papel e passa o valor da mão de obra → Pedro faz o orçamento (material + mão de obra) → negocia com o cliente (à vista; parcelado no Pix se for de confiança, com datas; senão parcelado no cartão).
23. **Quem visita:** o pai do Pedro e os calheiros. Pedro fica na fábrica (dobra e administrativo).
24. **Horário:** sem hora marcada; no máximo "amanhã de manhã". Nada de frescura.
25. **Escada:** normal ou alta (padrão); opção "muito alta" (geralmente barracão). Sem tipo de telhado nem outros detalhes técnicos.
26. **Status:** só dois — **"A medir"** e **"Medido"**. Depois de medido, o orçamento é criado.
27. **Fotos:** não.
28. **Medidas na visita:** não. Medidas vão direto no orçamento.
29/30. **Visualização:** agenda fica mais bonito (lista ou agenda, tanto faz).
30 (rota/mapa): não — calheiros não usam o app.
31. **Notificações:** sim, seria muito bom.
32. **Mensagem de confirmação no WhatsApp:** opcional, bom ter.
33. **Data:** normalmente NÃO tem data. Fica na fila ("sem previsão") até dar certo; aí liga para o cliente.
34. **Volume:** varia muito; já chegou a 5 visitas/dia.
35. **Cobrança de visita:** não.

## Rodada 2 – Perguntas 36 a 64 (respondidas em 05/11/2026)

### D. Orçamentos
36. **PDF:** exatamente igual ao modelo do Edgar (A5). Ajustes depois de ver.
37. **E-mail no cabeçalho:** deixar vazio por enquanto (Pedro manda depois).
38. **Número:** pode ser aleatório, mas NUNCA repetir. Serve para pesquisar o orçamento pelo número.
39. **Acréscimo:** REMOVER do PDF. Cliente nunca vê acréscimo; ajustes são só internos.
40. **Validade:** padrão 15 dias para aprovação.
41. **Itens:** lista pronta + texto livre. Dois estilos:
    - **Simples (o mais comum):** ex. "50 metros de calhas e rufos", "Mão de obra" — só valor total, unitário em branco.
    - **Detalhado:** cada item com quantidade, unitário e total (quando o cliente pede).
42. **Cálculo automático** corte × preço do metro × metragem: sim.
43. **Tabela de preços:** sim, editável, mas escondida em Configurações (uso raro).
44. **Preços atuais:**
    | Item | Preço |
    |---|---|
    | Bocal (2" e 4") | R$ 10,00 un |
    | Rebite / arrebite | R$ 0,30 un |
    | Bucha | R$ 0,30 un |
    | Brocante | R$ 0,30 un |
    | Silicone | R$ 35,00 un |
    | Estanho | R$ 35,00 un |
    | Condutor quadrado 25 / 28 / 33 | R$ 25,00 o metro (barra de 2 m = R$ 50,00) |
    | Condutor redondo 3" | R$ 30,00 o metro (barra de 2 m = R$ 60,00) |
    | Suporte para calha (moldura) | R$ 15,00 un |
    | Par de curva | R$ 75,00 o par |
    | Tampa | sem preço |
    | Calha / rufo / pingadeira | corte (m) × R$ 60 ou R$ 65 × metragem |
46. **Ajuste para bater o total:** continua — diferença dividida só nos itens por metro (calhas e rufos). Nunca em itens por unidade nem no condutor.
47. **Mão de obra:** sempre entra como item próprio (para mostrar que está inclusa).
48. **Custo/lucro:** não precisa.
49. **Status:** Rascunho → Enviado → Aprovado (→ pagamento: Em aberto / Parcial / Quitado / Vencido). Recusado existe mas é raro (cliente some).
50. **Aviso de orçamento sem resposta:** sim, com botão para mandar mensagem de lembrete ao cliente no WhatsApp.
51. **Envio:** WhatsApp Business. Botão para enviar direto seria ótimo.
52. **Duplicar orçamento:** não precisa.
53. **Juntar orçamentos:** manter (uso raro).
54. **Parcelamento:** cliente de confiança — qualquer forma, com datas combinadas ou até sem data (vem acertar uma vez por mês). Senão, só cartão.
55. **Pagamentos no PDF:** nas observações — data, valor, forma (Pix, dinheiro…) e quanto falta. Selo "P.G" ou "PAGO": tanto faz.
56. **Pagamento → financeiro:** entra sozinho como entrada.
57. **Nome do arquivo:** `Orçamento 364 - Edgar.pdf` (sem calheiro). Quando quitado: `Orçamento 364 - Edgar - PAGO.pdf`. Não marcar parcial no nome.
58. **Pasta no Drive:** não criar mais.
59. **Observações prontas:** não precisa; escreve na hora (raro).
60. **Garantia:** existe, mas não aparece no orçamento.
61. **Orçamentos antigos:** não importar.

### E. Calheiros
62. **Cadastro:** aba de calheiros, Pedro cadastra. Dalvo (pai do Pedro) é calheiro e trabalha na fábrica.
63. **Pagamento:** pelo valor da mão de obra do orçamento.
    - Dalvo + Miguel: dividem entre eles (Dalvo às vezes pega mais, cuida do carro/combustível); Dalvo diz quanto dar ao Miguel.
    - Terceirizados: mão de obra inteira vai para o calheiro (salvo desconto combinado). Pago em Pix/dinheiro.
64. **Agenda de serviços:** raro, mas útil quando o Dalvo agenda — com notificação.

## Pendências
- Perguntas 65 a 94 (bobinas, fornecedores, financeiro, migração, prioridade).
- Perguntas extras 35a, 35b, 35c (visitas).
- Código `gerar_orcamento.py` (se for encontrado).
