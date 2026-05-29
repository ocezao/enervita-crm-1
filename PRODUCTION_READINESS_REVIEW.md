# Revisão de prontidão para produção — Cockpit Comercial Enervita

Arquivo analisado: `C:\Users\cezao\Downloads\jules_session_67981387777715501_enervita-crm-frontend-67981387777715501.zip`

Pasta extraída/analisada: `C:\Users\cezao\Downloads\enervita-crm-jules-analysis`

## Veredito

**NO-GO para produção.**

A aplicação gerada pelo Jules é um bom protótipo visual de frontend, mas ainda não é um CRM operacional. Ela está usando dados mockados em memória, não tem autenticação, não tem backend/API real, não tem banco de dados/migrations e ainda falha no lint.

Pode ser usada como demonstração visual interna ou base de UI. Não deve ser colocada em produção com dados reais.

## Checks executados

- `npm ci`: passou
- `npm audit`: 0 vulnerabilidades conhecidas
- `npm run build`: passou
- `npm run lint`: falhou com 34 erros
- Navegação em preview local: app abre, mas há warnings de chart no console

## Evidências principais no código

- `src/hooks/useCrm.ts` importa `../lib/api/mockCrmApi`.
- `src/lib/api/mockCrmApi.ts` implementa tudo com arrays JS em memória e `delay()` artificial.
- `src/data/mockData.ts` contém os leads, contatos, tarefas, automações e webhooks mockados.
- `src/App.tsx` expõe todas as rotas diretamente, sem login ou guard de autenticação.
- Não existem migrations, ORM, `.env.example`, cliente HTTP real, Supabase/Firebase/Prisma/Drizzle, fetch/axios ou backend.

## O que falta para produção

### 1. Autenticação e autorização

Necessário criar:

- Tela de login.
- Sessão segura via cookie httpOnly ou provedor de auth.
- Proteção de rotas no frontend.
- Middleware/guard no backend.
- Perfis de acesso, no mínimo:
  - admin
  - gestor/comercial
  - SDR/vendedor
  - somente leitura, se necessário
- Controle por usuário/responsável.
- Recuperação de senha ou convite de usuário.
- Auditoria de login e mudanças sensíveis.

### 2. Backend/API real

Necessário criar endpoints reais para substituir `MockCrmApi`, no mínimo:

- `GET /api/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/leads`
- `POST /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `PATCH /api/leads/:id/stage`
- `GET /api/leads/:id/activities`
- `POST /api/leads/:id/activities`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `GET /api/dashboard/metrics`
- `GET /api/analytics`
- `GET /api/automations`
- `POST /api/automations`
- `GET /api/webhooks`
- `POST /api/webhooks`
- `POST /api/webhooks/:id/test`
- `GET /api/webhook-deliveries`
- `POST /api/events`

### 3. Banco de dados/tabelas

Tabelas mínimas recomendadas:

- `users`
- `roles`
- `user_roles`
- `clients` ou `tenants` se for multiempresa
- `contacts`
- `leads`
- `lead_stage_history`
- `tasks`
- `activities`
- `tracking_events`
- `automation_rules`
- `automation_runs`
- `webhooks`
- `webhook_deliveries`
- `sync_mappings`
- `audit_logs`
- `api_keys` ou `integration_tokens`
- `consent_records`

### 4. Integrações operacionais

Necessário conectar com a operação real:

- Site/formulários de lead.
- Banco operacional/PostgreSQL.
- n8n.
- OpenPanel/analytics, se mantido.
- Meta CAPI.
- GA4 Measurement Protocol.
- Google Ads Enhanced Conversions/Offline Conversions.
- Webhooks externos com retry e logs.

### 5. Segurança/LGPD

Necessário implementar:

- Validação server-side de todos os inputs.
- Rate limit nos endpoints públicos.
- CORS restrito.
- Security headers/CSP.
- Logs de auditoria.
- Consentimento e origem de consentimento.
- Política de retenção/exclusão/exportação de dados pessoais.
- Criptografia/mascaramento para tokens e segredos.
- Separação de permissões por função.

### 6. Correções de qualidade

- Corrigir os 34 erros de lint.
- Adicionar testes unitários e de integração.
- Adicionar testes e2e dos fluxos críticos:
  - login
  - criar lead
  - mover etapa
  - criar tarefa
  - concluir tarefa
  - registrar atividade
  - testar webhook
- Corrigir warnings de Recharts no console.
- Implementar code splitting para reduzir bundle inicial.
- Documentar deploy, env vars e arquitetura.
- Configurar rewrite/fallback do servidor para `BrowserRouter`.

## Problemas funcionais observados

- Busca global é visual, sem lógica real.
- Botão “Novo Lead” não abre formulário.
- Filtros de leads não filtram.
- Exportar CSV não exporta.
- Pipeline mostra cards, mas não tem drag-and-drop funcional.
- `updateStage` existe, mas não é usado no Pipeline.
- Lead Detail tem textarea, mas “Registrar Atividade” não chama `addActivity`.
- Tabs de tracking/propostas mostram “Recurso em desenvolvimento para a versão Mock”.
- Webhooks, automações e analytics são mockados.
- Configurações são majoritariamente placeholders.

## Prioridade sugerida de implementação

1. Decidir stack de backend/auth/banco.
2. Criar schema/migrations PostgreSQL.
3. Criar autenticação e proteção de rotas.
4. Substituir `MockCrmApi` por cliente real HTTP.
5. Implementar CRUD real de leads, contatos, tarefas e atividades.
6. Implementar ingestão de leads do site.
7. Implementar stage history e audit logs.
8. Implementar webhooks com fila/retry/logs.
9. Implementar dashboard/analytics consultando banco real.
10. Corrigir lint/testes/build e preparar deploy.

## Recomendação prática

Use este projeto como base visual/frontend. Para produção, eu recomendaria criar uma API com PostgreSQL e auth antes de qualquer deploy público. Se a ideia é ir rápido, o caminho mais curto é:

- Frontend Vite/React atual
- Backend Next.js API, NestJS, Fastify ou Express
- PostgreSQL
- Auth.js/NextAuth, Better Auth, Clerk ou Supabase Auth
- Prisma ou Drizzle para migrations
- Deploy atrás de Cloudflare/Nginx com HTTPS e rota protegida

Enquanto isso, se precisar mostrar para Enervita, publicar apenas como preview protegido por senha/Tailscale e com aviso interno de que é mock.
