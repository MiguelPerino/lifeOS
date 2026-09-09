# LifeOS

Um segundo cérebro pessoal para transformar pensamentos em próximos passos e conectar tarefas, projetos e conhecimento. Interface em português, tema claro/escuro e IA local.

Aplicação com persistência real no Supabase. Não existe modo de demonstração que substitua o banco por mocks. Sem configurar o Supabase, a tela de entrada explica a configuração necessária.

## O que está implementado

- Supabase Auth: cadastro, login, confirmação de e-mail, recuperação de senha, sessão por cookies e logout.
- Dashboard com tarefas do dia, atrasos, próximos prazos, progresso, conclusões, gráfico semanal, atividades e insights selecionados por IA a partir dos registros reais.
- CRUD de projetos, tarefas e notas; filtros, ordenação, tags, subtarefas e dependências com prevenção de ciclos.
- Smart Inbox com extração estruturada, revisão de todos os campos, edição de dependências, confirmação transacional e proteção contra duplicação em retries.
- Notas, ideias, eventos e lembretes com projeto e data opcionais. Eventos/lembretes são registros organizáveis; não enviam notificações externas.
- Embeddings `nomic-embed-text` de 768 dimensões, índice HNSW/pgvector, invalidação após edição e reindexação manual quando houver falha.
- Busca textual de tarefas, projetos, conteúdo de notas e tags; busca semântica de notas.
- Assistente com ferramentas somente de leitura, seleção de evidências por IA, referências verificadas e fatos montados pelo servidor.
- Planejamento diário manual ou sugerido por IA, revisão, horários editáveis, remoção, reordenação acessível e persistência após confirmação.
- Command palette com `Ctrl+K` / `Cmd+K`, navegação, criação, abertura de projetos e comandos naturais enviados ao Smart Inbox.
- Estados vazios, skeletons, mensagens de erro, toasts, tooltips, menu mobile e indicação de desconexão.

## Screenshots

Espaço preparado em [`docs/screenshots/`](docs/screenshots/README.md). Os testes de navegador geram capturas reais em `test-results/login-desktop.png` e `test-results/login-mobile.png` (arquivos ignorados pelo Git).

Não são incluídas capturas fictícias do dashboard como prova de integração.

## Stack e compatibilidade

- Next.js 16 / App Router, React 19 e TypeScript 6 em modo strict.
- Tailwind CSS 4 e componentes shadcn/ui locais, baseados em Radix UI; `components.json` permite estender a coleção.
- Supabase PostgreSQL, Auth e `@supabase/ssr`, com RLS em todas as tabelas de aplicação.
- pgvector, Zod 4, Ollama, Recharts, cmdk, Sonner e next-themes.
- ESLint 10 com a camada oficial `@eslint/compat` para os plugins do Next.js; Prettier, Vitest e Playwright.

`package-lock.json` fixa a resolução validada. Use `npm ci` para reproduzi-la. TypeScript 6 foi escolhido porque o ecossistema de lint ainda depende de sua API; o TypeScript 7 não é uma atualização intercambiável neste conjunto de ferramentas. O projeto usa Webpack, opção suportada pelo Next.js, após o Turbopack falhar ao abrir processos/portas internas no ambiente de desenvolvimento restrito.

## Começar localmente

Pré-requisitos: Node.js 22.13 ou superior, npm, Docker funcionando **se optar pelo Supabase local**, e uma chave Gemini ou Ollama para usar IA. Qwen 1.5B tem download de aproximadamente 986 MB e exige memória e espaço em disco disponíveis; a velocidade depende do seu hardware. GPU é opcional, mas CPU pode ser lenta.

```bash
npm install
cp .env.example .env.local
```

Escolha uma das opções de banco abaixo. Depois configure Gemini ou Ollama e execute `npm run dev`.

### Opção A — Supabase local, sem conta ou cartão

Com Docker iniciado e acessível ao seu usuário:

```bash
npm run db:start
npx supabase status
npm run db:migrate
```

O primeiro comando baixa imagens e pode demorar. A CLI está nas dependências do projeto. Copie a API URL e a **publishable key** (ou a chave legada `anon`) mostradas por `supabase status` para `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA_LOCAL
```

Studio local: `http://127.0.0.1:54323`. Caixa de e-mails de teste: `http://127.0.0.1:54324`.

`supabase/config.toml` configura os redirects locais e desativa a confirmação de e-mail apenas no ambiente local. Assim é possível criar uma conta e entrar imediatamente. Recuperação de senha local chega à caixa de e-mails de teste.

Para **recriar do zero apenas o banco local descartável**, `npm run db:reset` reaplica as migrations, mas apaga seus dados locais. Não use esse comando para atualizar uma instalação com dados que deseja preservar; use `npm run db:migrate`.

### Opção B — Supabase Free hospedado

1. Crie um projeto no plano Free e obtenha sua Project URL e publishable key em Connect / API Keys.
2. Preencha as duas variáveis públicas em `.env.local`. **Não use `service_role` nem uma secret key.**
3. Aplique o schema pela CLI:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push
```

4. Em Authentication / URL Configuration, configure `http://localhost:3000` como Site URL e permita `http://localhost:3000/auth/callback` e `http://localhost:3000/reset-password`. Ao publicar, inclua as URLs HTTPS do seu domínio.
5. A confirmação de e-mail segue a configuração do projeto. Se estiver ativada, confirme antes do login.

Tabelas, funções, índices, triggers e policies são criados por migration, sem copiar SQL manualmente no dashboard. A criação do projeto, URLs de autenticação e envio de e-mails são configurações do serviço Auth, não objetos SQL.

O serviço de e-mail padrão do Supabase hospedado tem restrições de destinatários e limites. Para uso pessoal, use o endereço autorizado da sua conta; para testes de cadastro sem e-mail, use Supabase local. Não há SMTP comercial obrigatório. Para uma instalação pública com vários usuários, configure um serviço SMTP apropriado às suas necessidades e verifique sua faixa gratuita.

### Gemini — local ou Vercel

O Gemini funciona no servidor, sem instalar modelos no computador. Crie uma chave no [Google AI Studio](https://aistudio.google.com/apikey) e preencha `.env.local`:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE_AQUI
GEMINI_CHAT_MODEL=gemini-3.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Na Vercel, adicione essas mesmas variáveis em Settings → Environment Variables e faça um novo deploy. Localmente, reinicie `npm run dev`. Não use `NEXT_PUBLIC_` na chave Gemini, não a coloque no GitHub nem no código do navegador. URL e chave pública Supabase continuam como já configuradas.

Sem chave, a IA fica desativada e os registros manuais continuam funcionando. Com chave, a integração atende interpretação da Inbox, assistente, sugestão de plano e busca semântica. Não são necessárias novas migrations para ativar Gemini. Ao trocar o modelo de embeddings, use **Reindexar** nas notas anteriores: a busca semântica recusa vetores de modelos diferentes até que a reindexação seja concluída. A busca textual continua disponível.

Os modelos padrão têm faixa gratuita na [tabela do Google](https://ai.google.dev/gemini-api/docs/pricing), sujeita à disponibilidade e às cotas da conta. A integração não ativa faturamento nem muda automaticamente para um serviço pago. Uma chave de projeto com faturamento ativado pode gerar cobranças conforme o plano da conta. No serviço gratuito, o conteúdo enviado pode ser usado para melhorar produtos Google; confira os [termos](https://ai.google.dev/gemini-api/terms).

O chat usa a [API generateContent](https://ai.google.dev/api/generate-content) com JSON Schema e validação Zod. A indexação usa `gemini-embedding-001`, tarefas de recuperação de documentos/consultas e vetores normalizados de 768 dimensões. Use modelos compatíveis com essas APIs ao alterar os padrões. Nenhum teste faz chamadas reais ao Gemini sem chave fornecida separadamente.

### Ollama

Instale a versão para seu sistema em [ollama.com/download](https://ollama.com/download). No Linux, o instalador oficial é:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Inicie o serviço se ele ainda não estiver em execução:

```bash
ollama serve
```

Em outro terminal:

```bash
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text
ollama list
curl http://localhost:11434/api/tags
```

Configure no `.env.local`:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:1.5b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

`qwen2.5:1.5b` é o padrão do LifeOS para reduzir o download (aproximadamente 986 MB, contra 4,7 GB do 7B). Por ser menor, pode interpretar pedidos complexos com menos precisão; revise as sugestões antes de confirmar. Veja os tamanhos na [biblioteca do Ollama](https://ollama.com/library/qwen2.5). Não configure CORS público nem exponha a porta 11434: todas as chamadas são feitas pelo servidor Next.js. No navegador, só existem chamadas a `/api/ai` e demais APIs do LifeOS.

### Usar no notebook sem recompilar durante a navegação

`npm run dev` é para desenvolver: compila páginas conforme são abertas e mantém ferramentas de desenvolvimento em memória. Para uso diário, pare esse processo com Ctrl+C e prepare o app uma vez:

```bash
npm run build
npm start
```

Nas próximas vezes, execute apenas `npm start` e abra `http://localhost:3000`. Refazer o build só é necessário após mudar código ou configuração usada no build. O build demora, mas ocorre antes do uso. Supabase e Gemini ainda dependem da conexão com a internet. Fechar o terminal interrompe o servidor.

A navegação valida a assinatura da sessão com `getClaims()`, aproveitando chaves públicas em cache quando disponíveis; as APIs continuam verificando a conta com `getUser()` antes de acessar dados. Projetos com assinatura simétrica ainda podem exigir uma chamada de rede para validar a sessão.

### Iniciar

```bash
npm run dev
```

Abra **http://localhost:3000**, crie sua conta e comece a usar. Reinicie o servidor após alterar variáveis de ambiente.

Para dados fictícios opcionais, exclusivamente no Supabase local:

```bash
npm run seed
```

O seed cria a conta `demo@lifeos.local`, com senha definida em `SEED_PASSWORD` (padrão em `.env.example`), projetos Deep Learning/RAG, tarefas dependentes e notas. Se a conta já tiver projetos, não altera nada. O script recusa URLs de banco hospedado. Com Ollama ligado, use **Reindexar** nas notas do seed.

## Variáveis de ambiente

| Variável                               | Onde é usada       | Comportamento                                                       |
| -------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Cliente e servidor | URL pública do projeto Supabase                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente e servidor | Chave pública publishable ou anon, protegida por RLS                |
| `AI_PROVIDER`                          | Somente servidor   | `gemini` ou `ollama`; vazio/ausente desativa IA; Gemini exige chave |
| `GEMINI_API_KEY`                       | Somente servidor   | Chave secreta Gemini; vazia mantém IA desativada                    |
| `GEMINI_CHAT_MODEL`                    | Somente servidor   | Padrão `gemini-3.5-flash-lite`                                      |
| `GEMINI_EMBEDDING_MODEL`               | Somente servidor   | Padrão `gemini-embedding-001`, 768 dimensões                        |
| `OLLAMA_BASE_URL`                      | Somente servidor   | Padrão `http://localhost:11434`                                     |
| `OLLAMA_CHAT_MODEL`                    | Somente servidor   | Padrão `qwen2.5:1.5b`                                               |
| `OLLAMA_EMBEDDING_MODEL`               | Somente servidor   | Padrão `nomic-embed-text`, 768 dimensões                            |
| `SEED_EMAIL`, `SEED_PASSWORD`          | Script local       | Conta fictícia de desenvolvimento                                   |
| `E2E_LOCAL`                            | Testes             | `1` habilita o teste real de integração com Supabase local          |
| `PLAYWRIGHT_CHANNEL`                   | Testes             | `chrome` usa o Chrome instalado; vazio usa Chromium do Playwright   |

As chaves públicas Supabase são identificadores públicos por design; não concedem acesso fora das policies. Segredos e configuração dos providers não são importados por componentes cliente. A aplicação não exige service role.

## Arquitetura

```text
src/
  app/                   Rotas, layouts e handlers HTTP
    (workspace)/         Dashboard, Today, Inbox, Tasks, Projects, Notes, Search, Assistant
    api/                 Fronteira autenticada, validação e respostas sanitizadas
  components/            Shell, editores, listas e componentes compartilhados
    ui/                  Primitivas shadcn/ui locais
  domain/                Tipos, schemas Zod, progresso, bloqueios e regras de planejamento
  services/              Consultas, indexação e ferramentas do assistente
  lib/
    ai/                  AIProvider, factory, configuração server-only, GeminiProvider e OllamaProvider
    supabase/            Clientes SSR/browser; nenhuma chave administrativa
supabase/
  migrations/            Schema SQL versionado e funções transacionais
  config.toml            Ambiente Supabase local
scripts/seed.ts           Seed pela API autenticada, sujeito a RLS
tests/                   Regras de domínio, PostgreSQL real embarcado e E2E
```

O cliente usa handlers HTTP autenticados. O servidor verifica a identidade via `getUser()`, vincula consultas ao usuário e usa a chave pública com o JWT da sessão. RLS continua ativa dentro das RPCs porque elas são `SECURITY INVOKER`.

### Schema

| Tabelas                           | Responsabilidade                                                |
| --------------------------------- | --------------------------------------------------------------- |
| `profiles`                        | Nome e preferência de fuso; perfil criado pelo trigger do Auth  |
| `projects`                        | Objetivos, status e prazo                                       |
| `tasks`                           | Status, prioridade, prazo, projeto, timestamps e conclusão      |
| `task_dependencies`               | Grafo dirigido, chaves por proprietário e rejeição de ciclos    |
| `subtasks`                        | Checklist ordenado de uma tarefa                                |
| `tags`, `task_tags`, `note_tags`  | Tags normalizadas por usuário                                   |
| `notes`                           | Conteúdo, tipo, projeto, data, vetor e estado de indexação      |
| `activities`                      | Ações relevantes de criação, mudanças de status, notas e planos |
| `daily_plans`, `daily_plan_items` | Um plano por usuário/data e itens ordenados                     |
| `inbox_receipts`                  | Confirmações idempotentes; retries não duplicam capturas        |

Toda referência entre entidades contém `user_id` na foreign key. RLS cobre tabelas principais e junctions. Dependências são verificadas recursivamente; operações transacionais usam um advisory lock por usuário. Excluir um projeto preserva tarefas/notas e remove seu vínculo. Excluir tarefas remove subtarefas, dependências e itens de plano associados.

O progresso ignora tarefas canceladas no denominador. Dependências canceladas permanecem bloqueadoras até serem removidas ou resolvidas explicitamente. `completed_at` é gerenciado por trigger, inclusive ao reabrir tarefas. Datas de prazo são `date` sem horário; o frontend envia a data local do dispositivo para resolver hoje/amanhã. Timestamps são UTC. O campo de fuso do perfil está reservado para futura preferência explícita; atualmente vale o fuso do dispositivo.

### Fluxo de IA

```text
Pensamento → API autenticada → Gemini/Ollama structured output → Zod
          → revisão editável → confirmação → RPC transacional com RLS
```

O provider recebe JSON Schema derivado dos schemas Zod. A resposta é validada novamente, inclusive datas, limites, índices e ciclos. O modelo nunca recebe acesso para executar SQL, shell ou mutações. A interpretação pode criar um projeto relacionado novo, mas isso é mostrado antes da confirmação.

O assistente funciona em duas etapas: seleciona ferramentas permitidas (`getTasks`, `getProjects`, `searchNotes`, `searchSemanticNotes`, `getUpcomingDeadlines`) e depois seleciona registros/trechos relevantes. **Títulos, datas, status e contagens são escritos pelo servidor a partir dos registros, não copiados de texto livre do LLM.** Trechos de notas precisam existir literalmente no conteúdo consultado; IDs precisam estar no conjunto recuperado. Resultados trazem links às fontes. O modelo ainda pode escolher uma fonte pouco relevante; nenhuma técnica garante relevância perfeita.

Cada pergunta é uma consulta independente. O histórico visual do chat permanece na página durante a sessão e não é armazenado no banco; tarefas, projetos, notas, atividades e planos são persistidos. As respostas do assistente são intencionalmente factuais e estruturadas, sem conversação aberta ou aconselhamento inventado.

O planejamento valida IDs, tarefas em aberto, precedência de dependências, horários, duplicatas e sobreposição antes de salvar. Reordenar recalcula horários consecutivos; você pode ajustá-los e adicionar intervalos antes de confirmar. Aceitar um plano não muda status nem prazos das tarefas.

### Embeddings e indisponibilidade

A nota é salva primeiro. A indexação é tentada no backend; falhas deixam a nota utilizável e marcam a indexação como pendente/falha. Atualizações de texto invalidam o vetor antigo. A escrita do embedding verifica `updated_at`, impedindo associar o vetor de uma versão anterior ao conteúdo novo.

Busca semântica usa similaridade de cosseno. Ollama recebe prefixos `search_document:` / `search_query:`; Gemini recebe os tipos `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`. Notas muito longas que excedam o contexto do modelo não são truncadas silenciosamente: a indexação falha e a nota continua salva. Divida-as em notas menores. Esta versão usa um vetor por nota; chunking de documentos extensos é uma evolução futura. Ao trocar o modelo de embeddings, reindexe as notas; alterar a dimensão exige migration.

Para adicionar outro provider, implemente `generate()`, `generateStructured()` e `embed()` em `src/lib/ai/`, registre-o na factory e mantenha os schemas/contratos. Gemini e Ollama estão implementados. Outros providers exigem uma integração adicional.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm test` executa as migrations completas em PGlite, um build WebAssembly de PostgreSQL com pgvector e pg_trgm. Testa RLS com dois usuários, chaves compostas, ciclos, rollback, timestamps, indexação e persistência de planos. O teste define somente o contrato mínimo `auth.users`/`auth.uid()` necessário para rodar SQL; não substitui um teste HTTP do Supabase Auth/PostgREST.

Testes no navegador:

```bash
npx playwright install chromium
npm run test:e2e
# Alternativa: usar Chrome já instalado
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

O smoke test verifica redirecionamento de páginas privadas, layout desktop/mobile, APIs sem autenticação e bloqueio de origem externa. Para executar o teste de cadastro e CRUD sem mocks:

```bash
# Supabase LOCAL iniciado, migrations aplicadas e .env.local configurado
E2E_LOCAL=1 npm run test:e2e
```

Esse teste cria uma conta descartável no Supabase local, verifica projeto/tarefa/nota/busca/plano, reload e command palette. Não roda contra Supabase hospedado. A conta de teste fica disponível para inspeção. A IA real precisa ser verificada com Ollama instalado: contratos e validação são testáveis automaticamente, mas qualidade semântica depende dos modelos.

### Estado da verificação nesta entrega

- Lint, typecheck, build de produção e testes de domínio/banco executados.
- Smoke tests de navegador executados, incluindo screenshots desktop/mobile da entrada.
- Cadastro/CRUD via Supabase real e inferência Ollama **não exercitados neste ambiente**: não havia credenciais Supabase, o Docker exigia autenticação administrativa e Ollama não estava instalado. O teste de integração é explicitamente pulado nessas condições, não marcado como aprovado.

## Deploy na Vercel

1. Publique seu repositório e importe como projeto Next.js na Vercel.
2. Configure as duas variáveis públicas Supabase, aplique `npm run db:push` e configure redirects HTTPS do Auth.
3. Configure `AI_PROVIDER=gemini`, `GEMINI_API_KEY` e os modelos conforme a seção Gemini. Para publicar sem IA, deixe `AI_PROVIDER` vazio. Não configure `localhost:11434` na Vercel.
4. Build: `npm run build`. Output e runtime seguem a detecção padrão de Next.js.

O banco hospedado preserva seus dados entre deploys. Sem provider em produção, dashboard, CRUD, busca textual e planejamento manual continuam funcionando; somente interpretação, insights por IA, chat, embeddings e busca semântica ficam indisponíveis.

```text
Desenvolvimento: navegador → Next.js local → Supabase + Ollama local
Produção: navegador → Next.js/Vercel → Supabase + Gemini (com chave)
```

Ollama não roda dentro de funções Vercel, e o localhost de uma função não é o seu computador. Não exponha um Ollama sem autenticação na Internet. Para IA remota, use a integração Gemini descrita acima. Você pode usar Next.js + Ollama local ou publicar Next.js com Gemini, respeitando as cotas gratuitas dos serviços.

## Custos

O LifeOS foi arquitetado para funcionar gratuitamente em desenvolvimento e uso pessoal, com **Supabase Free (ou Supabase local), Ollama local e bibliotecas open source**, sem API de IA paga ou cartão como dependência do projeto.

O hardware, armazenamento e energia usados na sua máquina continuam sendo seus recursos. Supabase Free tem quotas de banco e tráfego, e projetos inativos podem ser pausados. Vercel Hobby é adequado ao uso pessoal não comercial dentro de seus limites. Confira as condições atuais em [Supabase Pricing](https://supabase.com/pricing) e [Vercel Hobby](https://vercel.com/docs/plans/hobby).

APIs comerciais de IA, aumento de plano, servidor/GPU remoto, SMTP fora da faixa gratuita, domínio próprio e limites excedidos podem gerar custos futuramente. Nada disso é obrigatório para o fluxo local completo.

## Troubleshooting

| Sintoma                                       | Ação                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| “Conecte seu Supabase”                        | Preencha URL e chave pública em `.env.local` e reinicie Next.js                                                      |
| Erro ao consultar/salvar                      | Verifique se Supabase está ativo e migrations foram aplicadas; confira URL/chave                                     |
| Docker “permission denied”                    | Inicie Docker e configure acesso do seu usuário conforme a instalação do sistema; alternativamente use Supabase Free |
| E-mail não chega                              | No local, use a caixa em `:54324`; no hospedado, confira confirmação, spam e limites de envio                        |
| Link de recuperação inválido                  | Solicite um novo link no mesmo navegador e confira redirects do Auth                                                 |
| Modelo indisponível                           | Execute `ollama serve`, confira `ollama list` e o endereço backend                                                   |
| Ollama demora / timeout                       | A primeira carga é lenta; feche processos pesados e confira memória. Timeout por chamada: 120 segundos               |
| Nota salva, mas não encontrada semanticamente | Ligue Ollama e use Reindexar. Reduza notas que excedam o contexto do modelo                                          |
| Embeddings com dimensão incorreta             | Use `nomic-embed-text` de 768 dimensões ou crie migration antes de trocar a dimensão                                 |
| Tarefa bloqueada                              | Conclua ou remova a dependência. Dependência cancelada não é considerada concluída                                   |
| Plano recusado                                | Confira dependências anteriores, tarefas ainda abertas e horários sem sobreposição                                   |
| IA desativada no deploy                       | É o comportamento esperado sem provider configurado; CRUD continua independente                                      |
| Sem rede                                      | Dados já carregados podem ser lidos, mas mutações exigem conexão; não há fila offline nem service worker             |

## Limites conscientes

Aplicação orientada a uso pessoal. O workspace pagina as consultas ao Supabase para não perder registros acima do limite por resposta, mas mantém o conjunto de trabalho em memória no frontend. Grandes acervos devem evoluir para paginação por tela e busca textual no servidor. O assistente limita fontes para caber no contexto do modelo e não promete consultas exaustivas. Timeline mostra os 100 eventos mais recentes. Não há colaboração entre contas, anexos, editor rico, notificações push, sincronização realtime ou calendário externo nesta versão.

## Referências técnicas

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Supabase CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [PGlite e extensões](https://pglite.dev/extensions/)
- [Compatibilidade ESLint](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/)
