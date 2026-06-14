# Enervita CRM Production Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Transformar o frontend mockado gerado pelo Jules em um CRM real, com banco PostgreSQL, autenticação, usuário admin único inicial, criação de contas apenas pelo admin, permissões granulares por páginas/funções/estágios e preview rodando localmente na VPS para validação do Cesar.

**Architecture:** Manter o React/Vite atual como frontend e criar uma API real por trás dele. A API será responsável por autenticação, autorização, persistência, auditoria, permissões e operações de CRM. O primeiro deploy será um preview protegido rodando na VPS, sem substituir o Twenty CRM atual em `crm.enervita.com.br` até aprovação explícita.

**Tech Stack:** React + Vite + TypeScript no frontend; Node.js/Express ou Fastify no backend; PostgreSQL no banco; migrations SQL ou ORM leve; Docker Compose na VPS; Caddy como reverse proxy; autenticação com senha hash Argon2/bcrypt e sessão/JWT seguro.

---

## Premissas e decisões operacionais

1. O CRM novo não deve substituir o Twenty CRM atual em `crm.enervita.com.br` automaticamente.
2. O primeiro ambiente será preview interno na VPS, preferencialmente em uma porta local ou subdomínio temporário protegido.
3. O admin inicial será criado por seed/migration controlada, não por cadastro público.
4. Não haverá tela pública de “criar conta”.
5. Somente o admin poderá criar, editar, ativar/desativar e redefinir acesso de funcionários.
6. Funcionários só poderão ver páginas, executar ações e acessar etapas do funil que o admin liberar via checkboxes.
7. As permissões serão server-side, não apenas escondidas no frontend.
8. Dados pessoais de funcionários e leads exigem LGPD, auditoria e controle de acesso.
9. Secrets não serão impressos em terminal/chat.
10. Antes de qualquer deploy em produção pública, precisa rodar build, lint, testes e smoke test.

---

## Modelo de permissões solicitado pelo Cesar

O admin terá uma tela de “Usuários e Permissões” onde poderá marcar checkboxes para cada funcionário.

### Páginas controláveis

- Dashboard
- Leads
- Pipeline
- Detalhe do Lead
- Tarefas
- Automações
- Webhooks & API
- Analytics
- Configurações
- Usuários e Permissões

### Funções controláveis

- Ver leads
- Criar lead
- Editar lead
- Excluir/arquivar lead
- Avançar etapa
- Marcar como perdido
- Criar tarefa
- Concluir tarefa
- Reagendar tarefa
- Registrar atividade
- Exportar CSV
- Ver dados de tracking
- Ver analytics
- Gerenciar automações
- Testar webhooks
- Gerenciar webhooks
- Gerenciar configurações
- Gerenciar usuários

### Etapas controláveis

O admin poderá liberar quais etapas cada funcionário pode visualizar ou operar:

- Novo lead
- Qualificação
- Atendimento iniciado
- Conta recebida
- Diagnóstico
- Proposta enviada
- Contrato / Enervita
- Perdido

### Regra crítica

Mesmo que o frontend esconda botões, o backend precisa bloquear qualquer ação não autorizada. Não confiar apenas na UI.

---

## Entidades/tabelas principais

Usar como base o arquivo já criado:

`docs/PRODUCTION_SCHEMA_DRAFT.sql`

Adicionar/ajustar para permissões granulares:

- `users`
- `employee_profiles`
- `permissions`
- `user_permissions`
- `stage_permissions`
- `sessions` ou tabela equivalente, se usar sessão persistida
- `password_reset_tokens` ou `invitation_tokens`, se for criar fluxo por convite
- `audit_logs`

### Campos recomendados para funcionário

Tabela `employee_profiles`:

- `id`
- `user_id`
- `full_name`
- `document_number` opcional, com cuidado LGPD
- `job_title`
- `department`
- `phone`
- `whatsapp`
- `email`
- `birth_date` opcional
- `start_date`
- `notes`
- `emergency_contact_name` opcional
- `emergency_contact_phone` opcional
- `status`
- `created_at`
- `updated_at`

Observação: evitar coletar CPF/RG se não for realmente necessário para operação do CRM.

---

## Fase 0 — Preparação e backup

### Task 0.1: Congelar estado atual do projeto

**Objective:** Preservar o ZIP/protótipo original antes de mexer.

**Files:**
- Read: `C:\Users\cezao\Downloads\jules_session_67981387777715501_enervita-crm-frontend-67981387777715501.zip`
- Existing: `C:\Users\cezao\Downloads\enervita-crm-jules-analysis`

**Steps:**
1. Criar cópia de trabalho fora de Downloads, preferencialmente em projeto versionado.
2. Inicializar git se ainda não existir.
3. Commitar estado original.

**Commands:**

```bash
cd /c/Users/cezao/Downloads/enervita-crm-jules-analysis
git init
git add -A
git commit -m "chore: import jules crm prototype"
```

**Verification:**

```bash
git status --short
git log --oneline -1
```

Expected: working tree limpo e commit inicial criado.

---

### Task 0.2: Inspecionar VPS e definir pasta de deploy preview

**Objective:** Confirmar SSH, Docker, Caddy e escolher caminho seguro para o preview.

**Files:**
- VPS path target: `/opt/clients/enervita-crm-preview`

**Commands:**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'printf "SSH_OK\n"; hostname; docker ps --format "{{.Names}}" | sort | wc -l'
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'test -d /opt/clients && echo OPT_CLIENTS_OK || echo MISSING_OPT_CLIENTS'
```

**Verification:**

Expected: `SSH_OK`, hostname conhecido e Docker respondendo.

---

## Fase 1 — Estrutura de produção local

### Task 1.1: Reorganizar projeto para frontend + backend

**Objective:** Separar frontend atual de uma API real.

**Files:**
- Create: `apps/web/`
- Create: `apps/api/`
- Create: `packages/shared/`
- Move: `src/`, `vite.config.ts`, `package.json` frontend para `apps/web/`
- Create: root `package.json` com workspaces

**Implementation notes:**

Estrutura alvo:

```text
enervita-crm/
  apps/
    web/
    api/
  packages/
    shared/
  infra/
    docker/
    migrations/
  docs/
    plans/
```

**Verification:**

```bash
npm install
npm run build
```

Expected: frontend continua buildando.

---

### Task 1.2: Corrigir lint do frontend antes de integrar backend

**Objective:** Remover erros atuais para termos base limpa.

**Files:**
- Modify: `apps/web/src/components/layout/Topbar.tsx`
- Modify: `apps/web/src/components/ui/Base.tsx`
- Modify: `apps/web/src/components/ui/StatusBadges.tsx`
- Modify: `apps/web/src/hooks/useCrm.ts`
- Modify: `apps/web/src/pages/*.tsx`
- Modify: `apps/web/src/lib/api/types.ts`

**Known errors:**
- imports não usados
- `any`
- função `addActivity` importada e não usada
- `setLoading(true)` dentro de effect

**Verification:**

```bash
npm run lint
npm run build
```

Expected: lint e build passando.

---

## Fase 2 — Banco PostgreSQL e migrations

### Task 2.1: Criar migration inicial do CRM

**Objective:** Criar schema real do CRM.

**Files:**
- Create: `infra/migrations/001_initial_schema.sql`
- Use as base: `docs/PRODUCTION_SCHEMA_DRAFT.sql`

**Tables:**
- tenants
- users
- roles
- user_roles
- employee_profiles
- permissions
- user_permissions
- stage_permissions
- contacts
- leads
- lead_stage_history
- tasks
- activities
- tracking_events
- automation_rules
- automation_runs
- webhooks
- webhook_deliveries
- sync_mappings
- consent_records
- audit_logs
- integration_tokens

**Verification:**

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:check
```

Expected: migration aplica em banco local sem erro.

---

### Task 2.2: Criar seed do admin inicial

**Objective:** Criar apenas um admin inicial controlado por env.

**Files:**
- Create: `apps/api/src/db/seedAdmin.ts`
- Modify: `apps/api/.env.example`

**Env vars:**

```text
ADMIN_EMAIL=
ADMIN_NAME=
ADMIN_INITIAL_PASSWORD=
```

**Rules:**
- Se já existir admin, não criar outro automaticamente.
- Senha deve ser hasheada.
- Não logar senha no terminal.

**Verification:**

```bash
npm run db:seed-admin
```

Expected: admin criado ou mensagem segura “admin already exists”.

---

## Fase 3 — API e autenticação

### Task 3.1: Criar API base

**Objective:** Criar servidor API com healthcheck.

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/config/env.ts`

**Endpoints:**

```text
GET /health
```

**Verification:**

```bash
npm run dev:api
curl -s http://localhost:4000/health
```

Expected: `{"ok":true}`.

---

### Task 3.2: Implementar login/logout/me

**Objective:** Permitir autenticação do admin e funcionários criados pelo admin.

**Files:**
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/password.ts`
- Create: `apps/api/src/middleware/requireAuth.ts`

**Endpoints:**

```text
POST /api/auth/login
POST /api/auth/logout
GET /api/me
```

**Security:**
- Hash de senha com Argon2 ou bcrypt.
- Cookie httpOnly, secure em produção.
- SameSite lax/strict.
- Rate limit no login.
- Mensagem genérica para credencial inválida.

**Verification:**

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  --data '{"email":"admin@example.com","password":"***"}'
```

Expected: cookie de sessão/JWT seguro e `GET /api/me` retorna usuário sem password_hash.

---

### Task 3.3: Proteger todas as rotas de CRM

**Objective:** Impedir acesso sem login.

**Files:**
- Modify: API route registration
- Create: `apps/api/src/middleware/requirePermission.ts`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/auth/AuthProvider.tsx`
- Create: `apps/web/src/pages/Login.tsx`
- Create: `apps/web/src/components/auth/ProtectedRoute.tsx`

**Verification:**

1. Abrir `/leads` sem login.
2. Esperado: redireciona para `/login`.
3. Fazer login como admin.
4. Esperado: consegue abrir Dashboard/Leads/Settings.

---

## Fase 4 — Admin cria contas e permissões

### Task 4.1: Criar catálogo de permissões

**Objective:** Definir permissões fixas para páginas, ações e etapas.

**Files:**
- Create: `packages/shared/src/permissions.ts`
- Create: `apps/api/src/modules/permissions/permissionCatalog.ts`

**Permission keys examples:**

```ts
export const PERMISSIONS = {
  PAGE_DASHBOARD: 'page.dashboard',
  PAGE_LEADS: 'page.leads',
  PAGE_PIPELINE: 'page.pipeline',
  PAGE_TASKS: 'page.tasks',
  PAGE_AUTOMATIONS: 'page.automations',
  PAGE_WEBHOOKS: 'page.webhooks',
  PAGE_ANALYTICS: 'page.analytics',
  PAGE_SETTINGS: 'page.settings',
  PAGE_USERS: 'page.users',

  LEAD_VIEW: 'lead.view',
  LEAD_CREATE: 'lead.create',
  LEAD_EDIT: 'lead.edit',
  LEAD_STAGE_CHANGE: 'lead.stage_change',
  LEAD_MARK_LOST: 'lead.mark_lost',

  TASK_CREATE: 'task.create',
  TASK_COMPLETE: 'task.complete',
  ACTIVITY_CREATE: 'activity.create',
  CSV_EXPORT: 'csv.export',
  WEBHOOK_TEST: 'webhook.test',
  USER_MANAGE: 'user.manage',
} as const;
```

**Verification:**

```bash
npm run test -- permissions
```

Expected: catálogo exporta chaves esperadas.

---

### Task 4.2: Criar endpoints de usuários para admin

**Objective:** Permitir que somente admin crie e gerencie funcionários.

**Files:**
- Create: `apps/api/src/modules/users/users.routes.ts`
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.validation.ts`

**Endpoints:**

```text
GET /api/users
POST /api/users
GET /api/users/:id
PATCH /api/users/:id
PATCH /api/users/:id/status
POST /api/users/:id/reset-password
```

**Rules:**
- Somente admin ou permissão `user.manage`.
- Não permitir cadastro público.
- Não retornar `password_hash`.
- Criar audit log em toda alteração.

**Employee data fields:**
- nome completo
- e-mail
- telefone
- WhatsApp
- cargo/função
- departamento
- data de início
- observações
- status

**Verification:**

1. Login admin cria funcionário.
2. Login funcionário sem permissão tenta criar outro usuário.
3. Expected: 403.

---

### Task 4.3: Criar UI de usuários e permissões com checkboxes

**Objective:** Criar tela admin para configurar acessos.

**Files:**
- Create: `apps/web/src/pages/UsersPermissions.tsx`
- Create: `apps/web/src/components/users/UserForm.tsx`
- Create: `apps/web/src/components/users/PermissionCheckboxMatrix.tsx`
- Create: `apps/web/src/components/users/StagePermissionCheckboxes.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

**UI sections:**

1. Lista de funcionários.
2. Botão “Novo funcionário”.
3. Formulário de dados pessoais/profissionais.
4. Checkboxes de páginas liberadas.
5. Checkboxes de ações/funções liberadas.
6. Checkboxes de etapas do pipeline liberadas.
7. Status ativo/inativo.
8. Botão salvar.

**Verification:**

- Admin vê menu “Usuários e Permissões”.
- Funcionário sem permissão não vê menu.
- Funcionário sem rota direta recebe 403/redirect.

---

## Fase 5 — Substituir MockCrmApi por API real

### Task 5.1: Criar cliente HTTP real no frontend

**Objective:** Trocar mock por API real com sessão.

**Files:**
- Create: `apps/web/src/lib/api/httpClient.ts`
- Create: `apps/web/src/lib/api/realCrmApi.ts`
- Modify: `apps/web/src/hooks/useCrm.ts`
- Keep temporarily: `mockCrmApi.ts` only for story/demo if needed

**Verification:**

```bash
npm run build
```

E no browser:
- Dashboard busca `/api/dashboard/metrics`.
- Leads busca `/api/leads`.

---

### Task 5.2: Implementar leads/contacts reais

**Objective:** Persistir leads e contatos no banco.

**Files:**
- Create: `apps/api/src/modules/leads/leads.routes.ts`
- Create: `apps/api/src/modules/leads/leads.service.ts`
- Create: `apps/api/src/modules/contacts/contacts.service.ts`

**Endpoints:**

```text
GET /api/leads
POST /api/leads
GET /api/leads/:id
PATCH /api/leads/:id
PATCH /api/leads/:id/stage
```

**Authorization:**
- `lead.view` para listar/ver.
- `lead.create` para criar.
- `lead.edit` para editar.
- `lead.stage_change` + stage permission para mover etapa.

**Verification:**

1. Criar lead.
2. Recarregar página.
3. Lead continua existindo.
4. Funcionário sem acesso à etapa `proposta_enviada` não vê leads nessa etapa.

---

### Task 5.3: Implementar tarefas e atividades reais

**Objective:** Persistir tarefas e timeline.

**Files:**
- Create: `apps/api/src/modules/tasks/tasks.routes.ts`
- Create: `apps/api/src/modules/tasks/tasks.service.ts`
- Create: `apps/api/src/modules/activities/activities.routes.ts`
- Create: `apps/api/src/modules/activities/activities.service.ts`
- Modify: `apps/web/src/pages/LeadDetail.tsx`
- Modify: `apps/web/src/pages/Tasks.tsx`

**Fix required:**
- O botão “Registrar Atividade” deve chamar `addActivity`.
- Tarefa concluída deve persistir no banco.

**Verification:**

1. Registrar atividade em lead.
2. Recarregar página.
3. Atividade continua na timeline.
4. Concluir tarefa.
5. Recarregar página.
6. Tarefa continua concluída.

---

## Fase 6 — Dashboard, analytics, automações e webhooks

### Task 6.1: Dashboard com dados reais

**Objective:** Dashboard deve consultar o banco.

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Modify: `apps/web/src/pages/Dashboard.tsx`

**Metrics:**
- Leads novos hoje
- Leads sem follow-up
- Tarefas vencidas
- Propostas abertas
- Leads por origem
- Leads por etapa
- Conversões por plataforma
- Atividades recentes

**Verification:**

Inserir lead/tarefa e confirmar métrica muda.

---

### Task 6.2: Webhooks reais com logs

**Objective:** Criar webhooks configuráveis com teste e logs.

**Files:**
- Create: `apps/api/src/modules/webhooks/webhooks.routes.ts`
- Create: `apps/api/src/modules/webhooks/webhooks.service.ts`
- Create: `apps/api/src/modules/webhooks/webhookDeliveryWorker.ts`
- Modify: `apps/web/src/pages/Webhooks.tsx`

**Rules:**
- Somente admin/permissão webhook.
- Logar entregas.
- Retry com backoff.
- Não imprimir secrets.

**Verification:**

- Criar webhook de teste.
- Clicar “Testar webhook”.
- Ver delivery log salvo.

---

### Task 6.3: Automações v1

**Objective:** Implementar regras simples de automação, começando por criação de tarefa.

**Files:**
- Create: `apps/api/src/modules/automations/automations.routes.ts`
- Create: `apps/api/src/modules/automations/automations.service.ts`

**First rules:**
- lead novo -> criar tarefa follow-up
- lead 24h sem contato -> criar alerta/tarefa
- proposta enviada -> criar tracking_event

**Verification:**

Criar lead e confirmar tarefa automática.

---

## Fase 7 — Deploy preview na VPS

### Task 7.1: Criar Docker Compose do preview

**Objective:** Rodar web, api e postgres na VPS em ambiente isolado.

**Files:**
- Create: `infra/docker/Dockerfile.web`
- Create: `infra/docker/Dockerfile.api`
- Create: `docker-compose.preview.yml`
- Create: `.env.preview.example`

**Services:**
- `enervita-crm-preview-web`
- `enervita-crm-preview-api`
- `enervita-crm-preview-postgres`

**Verification local:**

```bash
docker compose -f docker-compose.preview.yml up -d --build
curl -s http://localhost:4000/health
```

---

### Task 7.2: Subir código para VPS

**Objective:** Copiar projeto para `/opt/clients/enervita-crm-preview`.

**Commands:**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'mkdir -p /opt/clients/enervita-crm-preview'
rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  ./ agencia-vps:/opt/clients/enervita-crm-preview/
```

**Verification:**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'test -f /opt/clients/enervita-crm-preview/docker-compose.preview.yml && echo DEPLOY_FILES_OK'
```

---

### Task 7.3: Rodar localmente na VPS para o Cesar ver

**Objective:** Subir preview no servidor sem ainda expor como produção oficial.

**Commands:**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'cd /opt/clients/enervita-crm-preview && docker compose -f docker-compose.preview.yml up -d --build'
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'cd /opt/clients/enervita-crm-preview && docker compose -f docker-compose.preview.yml ps'
```

**Verification:**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'curl -fsS http://127.0.0.1:4000/health && echo API_OK'
ssh -o BatchMode=yes -o ConnectTimeout=12 agencia-vps 'curl -fsSI http://127.0.0.1:4174 | head -20'
```

Expected:
- API saudável.
- Web responde localmente.

---

### Task 7.4: Expor preview com segurança

**Objective:** Permitir visualização pelo Cesar, sem abrir CRM sem proteção.

**Options:**

A. Apenas Tailscale/porta local na VPS.
B. Subdomínio temporário protegido por Caddy Basic Auth ou Cloudflare Access.
C. Subdomínio protegido por allowlist de IP fixo/Tailscale.

**Preferred for first preview:**
- Não usar `crm.enervita.com.br`.
- Usar hostname temporário protegido.
- Se não houver DNS pronto, validar via SSH tunnel primeiro.

**Verification:**

- Abrir URL de preview.
- Fazer login como admin.
- Ver Dashboard.
- Criar funcionário.
- Definir permissões via checkboxes.
- Logar como funcionário.
- Confirmar páginas/funções/etapas bloqueadas.

---

## Fase 8 — QA e critérios de aceite

### Task 8.1: Testes mínimos automatizados

**Objective:** Não aceitar produção sem testes dos fluxos críticos.

**Tests:**
- Login admin OK.
- Login inválido falha.
- Admin cria funcionário.
- Funcionário sem permissão não acessa `/users`.
- Admin concede página Leads.
- Funcionário vê Leads.
- Admin remove página Leads.
- Funcionário não vê Leads.
- Stage permission bloqueia lead de etapa não liberada.
- Criar lead persiste.
- Mover etapa grava histórico.
- Registrar atividade persiste.
- Concluir tarefa persiste.

**Commands:**

```bash
npm run test
npm run lint
npm run build
```

Expected: tudo passando.

---

### Task 8.2: Smoke test manual na VPS

**Objective:** Confirmar que o preview está utilizável para o Cesar avaliar.

**Checklist:**

- [ ] Login admin funciona.
- [ ] Logout funciona.
- [ ] Funcionário não consegue criar conta.
- [ ] Admin cria funcionário.
- [ ] Admin edita dados pessoais/profissionais.
- [ ] Admin marca/desmarca permissões por checkbox.
- [ ] Permissões de páginas funcionam.
- [ ] Permissões de funções funcionam.
- [ ] Permissões por etapa funcionam.
- [ ] Leads persistem após refresh.
- [ ] Tarefas persistem após refresh.
- [ ] Atividades persistem após refresh.
- [ ] Dashboard mostra dados reais.
- [ ] API health OK.
- [ ] Containers saudáveis.
- [ ] Nenhum segredo apareceu em log/chat.

---

## Fase 9 — Go/No-Go para produção real

### Critérios mínimos para GO

- [ ] Autenticação real implementada.
- [ ] Cadastro público inexistente.
- [ ] Apenas admin cria contas.
- [ ] Permissões server-side por página/função/etapa.
- [ ] Banco persistente com migrations.
- [ ] Backups definidos.
- [ ] Audit logs para ações críticas.
- [ ] Lint passando.
- [ ] Build passando.
- [ ] Testes críticos passando.
- [ ] Preview validado pelo Cesar.
- [ ] Deploy protegido.
- [ ] LGPD mínima documentada.

### Critérios de NO-GO

- Qualquer rota sensível acessível sem login.
- Funcionário consegue chamar API sem permissão.
- Dados somem após refresh.
- Admin não consegue revogar acesso.
- Senhas/tokens aparecem em log.
- Lint/build/test falham.
- Preview público sem proteção.

---

## Ordem recomendada de execução

1. Commitar protótipo original.
2. Corrigir lint do frontend.
3. Criar estrutura web/api/shared.
4. Criar banco e migrations.
5. Criar seed do admin.
6. Criar login/logout/me.
7. Proteger rotas.
8. Criar permissões granulares.
9. Criar gestão de usuários/funcionários.
10. Trocar mock por API real.
11. Implementar leads/contacts.
12. Implementar tasks/activities.
13. Implementar dashboard real.
14. Implementar webhooks/automações v1.
15. Dockerizar preview.
16. Subir na VPS.
17. Rodar localmente na VPS.
18. Expor preview protegido para o Cesar.
19. Rodar QA.
20. Decidir produção.

---

## Observação final

Este plano transforma o protótipo do Jules em um sistema real. A parte mais importante não é apenas criar tabelas: é garantir que autenticação, autorização e permissões sejam aplicadas no backend. A UI de checkboxes será só a interface; a proteção verdadeira precisa ficar na API.
