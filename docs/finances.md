# Finanças pessoais

A área **Finanças** fica no menu do LifeOS e usa a mesma conta e o mesmo Supabase.

- Registre gastos manualmente ou escreva um gasto por vez, como “Gastei 42,50 no almoço hoje”. A IA interpreta e o aplicativo salva e atualiza os gráficos. É possível corrigir ou desfazer.
- Consulte gastos de hoje, do mês e por categoria. A lista tem páginas de 20 registros; os totais e gráficos consideram o mês inteiro filtrado.
- Crie metas como “Meu PC”, informe o valor desejado e registre depósitos ou retiradas. Reservas não são despesas, não movimentam dinheiro real e não dependem do mês escolhido. O card mostra até dez movimentos recentes, mas seu total inclui todo o histórico.
- Valores são em reais, com cálculos em centavos. Cada usuário só acessa seus registros. Tentativas repetidas com a mesma chave não duplicam um salvamento.

## Publicar na Vercel

O build existente (`next build`) **não aplica migrations**. Antes de usar a nova área em produção:

1. No Supabase já vinculado ao projeto, aplique `supabase/migrations/202609100001_finances.sql`. Pelo terminal com a CLI autenticada e o projeto correto vinculado, execute `npm run db:push`. Esse comando aplica todas as migrations pendentes; confira a lista apresentada. Alternativamente, execute o arquivo completo no SQL Editor do projeto correto e reconcilie o histórico de migrations antes de voltar à CLI.
2. Envie o código ao branch que já dispara o deploy da Vercel.
3. Abra Finanças, registre um gasto, recarregue a página e confira o valor. Crie uma meta e adicione uma reserva; ela não deve aumentar o gasto do mês.

Não use `db:reset` para atualizar o ambiente com seus dados. A nova migration adiciona estruturas financeiras sem substituir tarefas, projetos ou notas. Não é necessário configurar cron, instalar dependências novas ou criar outra conta/serviço.

Se a IA já funciona na Vercel, a captura financeira usa o mesmo provider e as mesmas variáveis. Para Gemini: `AI_PROVIDER=gemini` e `GEMINI_API_KEY`, com os modelos opcionais já documentados no README. Nenhuma chave adicional é necessária. Ollama em `localhost` do seu computador não fica acessível a partir da Vercel. Sem IA configurada, gastos manuais e metas continuam funcionando.

Esta versão não inclui receitas, integração bancária, recorrências nem comandos financeiros no assistente geral. O campo de IA fica na própria página Finanças e aceita gastos realizados; metas são gerenciadas pelos botões. O conteúdo da frase é enviado ao provider configurado.
