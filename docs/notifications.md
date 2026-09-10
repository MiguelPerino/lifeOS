# Notificações no Android

O LifeOS pode ser instalado como PWA. A tela **Notificações** configura os avisos e ativa cada aparelho. Usa Web Push, Supabase para guardar preferências/inscrições e Supabase Cron para chamar o endpoint protegido do deploy Vercel a cada cinco minutos.

## Avisos disponíveis

| Tipo               | Padrão            | Conteúdo                                                            |
| ------------------ | ----------------- | ------------------------------------------------------------------- |
| Seu dia pela manhã | 08:00, ativado    | Tarefas abertas com prazo hoje ou presentes no planejamento de hoje |
| Pendências do dia  | 17:00, ativado    | O que continua aberto entre essas tarefas                           |
| Prazos chegando    | 19:00, ativado    | Tarefas abertas que vencem amanhã                                   |
| Revisar atrasos    | 09:00, desativado | Tarefas abertas com prazo anterior a hoje                           |

O fuso padrão é America/Sao_Paulo, editável. Silêncio das 22:00 às 07:00. Uma tarefa planejada e com prazo hoje aparece uma única vez no resumo. Concluídas/canceladas ficam de fora. Nada é enviado quando não há tarefas relevantes. Cada tipo gera um resumo por dia por aparelho, com até dois títulos. Um resumo com uma única tarefa abre essa tarefa; os demais abrem Meu dia ou Tarefas.

As tarefas atuais guardam data, sem horário de vencimento: o aviso de prazo é na véspera. Não há recorrência automática de tarefas. Preferências valem para todos os aparelhos; ativação/desativação é por aparelho. Sair da conta remove a inscrição do aparelho antes do logout.

## Ativar no deploy existente

1. Aplique a migration nova no projeto Supabase vinculado: `npm run db:push`. Não use `db:reset` no banco com seus dados. Alternativamente, execute o conteúdo de `supabase/migrations/202609090001_notifications.sql` no SQL Editor e depois reconcilie o histórico da CLI antes de usá-la novamente.
2. Na sua máquina, gere o par de chaves com `npx web-push generate-vapid-keys`. Guarde o par; não gere chaves novas a cada deploy. Para o token do agendador, gere outro segredo com `openssl rand -hex 32`.
3. Em Vercel → Settings → Environment Variables, configure no ambiente **Production**:

   | Variável                       | Valor                                                         |
   | ------------------------------ | ------------------------------------------------------------- |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública gerada pelo web-push                            |
   | `VAPID_PRIVATE_KEY`            | Chave privada gerada pelo web-push                            |
   | `VAPID_SUBJECT`                | `mailto:seu-email-real`                                       |
   | `SUPABASE_SERVICE_ROLE_KEY`    | Chave service_role do seu projeto Supabase (somente servidor) |
   | `CRON_SECRET`                  | Segredo aleatório gerado no passo 2                           |

   As duas variáveis públicas Supabase existentes continuam necessárias. Esta funcionalidade é uma exceção à configuração original somente com publishable key: o agendador precisa ler as tarefas sem sessão de navegador. A service_role fica exclusivamente no servidor, em módulo `server-only`.

4. Faça deploy do código e um novo build após configurar as variáveis: a chave pública VAPID é incorporada no build do navegador. Confirme que login e a página Notificações abrem no domínio de produção.
5. No Supabase → Vault, crie `lifeos_url` com a URL HTTPS estável de produção e `lifeos_cron_secret` com o mesmo valor de `CRON_SECRET`. Não use uma URL temporária de preview.
6. Execute [setup-notification-cron.sql](../supabase/setup-notification-cron.sql) no SQL Editor. O script verifica os segredos, habilita pg_cron/pg_net e cria/atualiza o job `lifeos-notifications`. Não contém valores secretos. As extensões de agendamento ficam fora da migration de dados para manter os testes PostgreSQL portáveis.
7. No Android, abra o endereço no Chrome → menu ⋮ → Instalar aplicativo/Adicionar à tela inicial. Entre na conta, abra **Notificações**, escolha os horários, ative e aceite a permissão. Use **Enviar teste**. “Teste enviado” confirma aceitação pelo serviço push, não que o aparelho mostrou o aviso.
8. Para testar o fluxo automático, crie uma tarefa com prazo hoje e ajuste o resumo diário para daqui a cinco minutos, fora do silêncio. Salve e aguarde a próxima execução. Se esse tipo já foi enviado hoje nesse aparelho, use outro tipo ou teste no próximo dia; mudar o horário não remove a proteção contra duplicatas.

Nenhum segredo deve ser colado em conversas ou versionado. O teste no Android e o agendador real só podem ser confirmados depois dessa configuração externa.

## Verificação e operação

- Supabase → Cron: veja as execuções de `lifeos-notifications`. O sucesso do SQL significa que a chamada foi enfileirada; confira também `net._http_response` para o HTTP e os logs da função na Vercel.
- O endpoint `/api/cron/notifications` aceita POST/GET somente com `Authorization: Bearer <CRON_SECRET>`. Sem token responde 401; configuração incompleta responde 503. A resposta contém contagens `sent` e `failed`, sem conteúdo privado. Falhas de envio respondem 503 e são tentadas em execuções posteriores dentro da janela.
- Há tolerância de 30 minutos após o horário escolhido. Avisos antigos e horários no silêncio são descartados. Falhas prolongadas não geram uma enxurrada de resumos atrasados.
- Recibos no banco evitam reenvios em execuções simultâneas, por aparelho e tipo/data. Uma concessão expira após cinco minutos se o processo falhar. Existe a possibilidade residual de repetição se o serviço push aceitar o envio e o processo morrer antes de registrar o sucesso. A tag estável substitui a notificação equivalente no aparelho quando possível.
- Inscrições que retornam 404/410 são removidas. O botão Reativar permite registrar novamente; se a inscrição expirou no provedor, desative e ative no aparelho. Testes são limitados a um por minuto por inscrição.
- O aplicativo não armazena páginas autenticadas em cache nem oferece edição offline. Push depende de rede, permissões e das restrições do Android; não é um alarme com entrega exata. Use também Não perturbe no aparelho para silenciar uma mensagem cuja entrega tenha sido atrasada pela rede (TTL de 30 minutos).
- A rotina tem limite de tempo e pagina inscrições/tarefas. Foi dimensionada para uso pessoal; se retornar `incomplete`, a execução atingiu seu orçamento e é hora de adotar fila/workers para esse volume. Monitore consumo de invocações e banco conforme seu plano.
- Para pausar todos os envios: `select cron.unschedule('lifeos-notifications');`. Para retomar, execute novamente o script de configuração. Remover o ícone da tela inicial não substitui desativar notificações no app/Chrome.

## Referências

- [Guia PWA do Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Limites do Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby limita cada job a uma execução diária, por isso o agendamento frequente fica no Supabase.
- [Supabase Cron](https://supabase.com/docs/guides/cron) e [agendamento com pg_net e Vault](https://supabase.com/docs/guides/functions/schedule-functions).
