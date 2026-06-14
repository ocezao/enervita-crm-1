# AGENTS.md — Enervita CRM

Monorepo de CRM comercial para a Enervita (energia solar). API Fastify + React/Vite frontend + pacote shared de tipos/permissões. Multi-tenant por design, com PostgreSQL como banco.

## Essential Commands

```bash
# Install (from repo root — npm workspaces)
npm install

# Development
npm run dev:api          # API dev server (tsx watch, port 4000)
npm run dev:web          # Web dev server (vite, proxies /api to localhost:4000)

# Build & Lint
npm run build            # Builds @enervita/web only (tsc -b && vite build)
npm run lint             # Lints @enervita/web (eslint)

# Tests
npm run test             # Runs both API + web tests
npm run test:api         # API tests only (node --import tsx --test src/__tests__/*.test.ts)
npm run test --workspace @enervita/web  # Web tests only (vitest run)

# Typecheck
npm run typecheck:api    # tsc -p tsconfig.json (noEmit, strict)

# Database
npm run db:migrate       # Run all SQL migrations (apps/api/scripts/db-migrate.mjs)
npm run db:check         # Verify schema matches migration contract
npm run db:seed-admin    # Seed initial admin user (needs ADMIN_EMAIL, ADMIN_PASSWORD env vars)

# Migration integrity
npm run test:migration   # Check migration file against contract

# Full production verification
npm run verify:production  # typecheck:api + test:api + lint + web test + build + test:migration

# Background workers (normally run in Docker)
npm run dispatch:meta-capi       # Dispatch Meta CAPI tracking events
npm run run:notification-rules   # Run notification rule engine
```

## Architecture

### Monorepo Layout

```
enervita-crm/
├── apps/api/          # Fastify API (Node 20, ESM, tsx)
├── apps/web/          # React + Vite + Tailwind + Radix UI
├── packages/shared/   # Shared types: permissions, pipeline stages
├── infra/migrations/  # Sequential SQL migrations (001_..014_..)
├── scripts/           # Deploy, sync, worker scripts
└── docker-compose.yml # Full stack: postgres, api, web, proxy, workers
```

### API Module Pattern (`apps/api/src/modules/`)

Every domain module follows this structure:

```
modules/<domain>/
├── <domain>.routes.ts    # Fastify route registration (HTTP layer)
├── <domain>.service.ts   # Business logic (optional, some put it in routes)
├── repository.ts         # PostgreSQL data access (Pool-based, raw SQL)
└── validation.ts         # Input validation (manual, no schema library)
```

**Key pattern — Dependency Injection via `createApp()`**:
- `app.ts` creates all repositories and passes them into route registrators
- Tests inject fake repositories to avoid hitting PostgreSQL
- Each repository is created from a `databaseUrl` string via `createPg<Name>Repository(databaseUrl)`
- Repositories expose a `close?()` method for pool cleanup

**Route registration pattern**:
```typescript
export async function registerXRoutes(app: FastifyInstance, options: { ... }) {
  const preHandler = requirePermission('permission.key', { userRepository, sessionSecret });
  app.get('/api/x', { preHandler }, async (request, reply) => { ... });
}
```

### Auth & Permissions

- **Session-based auth**: Custom HMAC-signed cookie (`enervita_session`), 8h TTL
  - Session token: `base64url(payload).base64url(hmac-sha256)` — NOT JWT
  - `SESSION_SECRET` must be ≥32 chars (hard fail in production)
- **Multi-tenant**: Every table has `tenant_id`. Auth resolves tenant from user row
- **Permission model** (defined in `@enervita/shared`):
  - Page permissions (`page.dashboard`, `page.leads`, etc.) — control navigation
  - Action permissions (`lead.create`, `lead.edit`, `lead.stage_change`, etc.) — control API actions
  - Stage permissions (`allowedStages`) — non-admin users only see/modify leads in their allowed pipeline stages
  - Admin role bypasses ALL permission checks (`isAdminUser()` returns true → full access)
- **`requireAuth`** = just authentication; **`requirePermission(key)`** = authentication + specific permission check
- Non-admin sellers are scoped to their own `sdr_owner_id` on lead queries

### Pipeline Stages (Portuguese keys, DO NOT translate)

```
novo_lead → qualificacao → atendimento_iniciado → conta_recebida → diagnostico → proposta_enviada → contrato_enervita
                                                                                                  ↘ perdido
```

Stage keys are used as PostgreSQL enum values (`lead_stage`), in permission scopes, in Meta CAPI event names, and throughout the frontend. Changing a key requires a migration + shared package update + full stack audit.

### Meta CAPI Integration

Lead mutations (create, stage change, tag update) automatically queue `tracking_events` rows. A background worker (`meta-capi-dispatcher`) dispatches them to Meta Conversions API. Key gotcha: **manual Kanban stage changes have a 10-minute debounce delay** before dispatching — this is intentional to avoid sending rapid intermediate events when users drag leads between stages quickly.

### Migration System

- SQL files in `infra/migrations/`, numbered sequentially (`001_initial_schema.sql` → `014_follow_up_queue.sql`)
- **Migrations are idempotent** (use `create table if not exists`, `do $$ begin if not exists...`)
- `apps/api/scripts/migration-contract.mjs` defines the **expected schema contract**: required tables, columns, enums, constraints. `npm run db:check` verifies the live DB matches this contract
- **When adding a new migration**: Update `migrationFiles` array AND `requiredTables`/`requiredColumns`/`requiredConstraints` in `migration-contract.mjs`
- Migration filenames sometimes skip numbers (009 jumps to 011, there are two 012s) — this is from parallel feature branches. Don't renumber existing files

### Web Frontend (`apps/web/`)

- **React 19 + TypeScript 6 + Vite 8 + Tailwind 4 + Radix UI**
- Design system documentado em `docs/DESIGN_SYSTEM.md` — tokens, componentes, convenções visuais
- Auth context (`AuthProvider`) calls `/api/auth/me` on mount; wraps the app
- `ProtectedRoute` component checks page permissions from user's permission list
- API client: `lib/api/crmApi.ts` — a typed interface (`CrmApi`) with a real HTTP implementation (`crmApi.ts`) that calls `/api/*` endpoints
- There's still a `mockCrmApi.ts` file from the original prototype — it's NOT used in production (the real `crmApi.ts` is imported in `useCrm.ts`)
- UI labels are in **Portuguese (Brazilian)** — match existing language

### Testing Patterns

**API tests** (`node:test` + `node:assert/strict`):
- Create `createApp()` with injected fake repositories (no database needed)
- Use `app.inject()` (Fastify's built-in test helper) to make HTTP requests
- Login flow: POST `/api/auth/login` → extract `set-cookie` header → use as `cookie` header
- Each test uses `t.after(async () => app.close())` for cleanup
- Fakes are defined inline per test file — NOT shared test fixtures

**Web tests** (Vitest + jsdom + @testing-library/react):
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`
- `globals: true` in vitest config — no need to import `describe`/`it`/`expect`

### Docker Compose Services

| Service | Purpose |
|---------|---------|
| `postgres` | PostgreSQL 16 on port 55432 (host) → 5432 (container) |
| `api` | Fastify API on port 43123 |
| `web` | Vite preview on port 43124 |
| `proxy` | Unified reverse proxy on port 43210 |
| `operational-lead-sync` | Syncs leads from external operational DB |
| `meta-capi-dispatcher` | Dispatches Meta CAPI events (default every 5min) |
| `notification-rules-runner` | Runs notification rule engine (default every 1h) |

### Environment Variables

See `apps/api/.env.example` for local dev. Key variables:

- `DATABASE_URL` — PostgreSQL connection string (default: `postgres://enervita:enervita@127.0.0.1:55432/enervita_crm`)
- `SESSION_SECRET` — ≥32 chars, required in production
- `META_ADS_ACCESS_TOKEN` + related `META_*` vars — Meta Ads/CAPI integration
- `OPENROUTER_API_KEY` — AI assistant (defaults to `deepseek/deepseek-chat-v3-0324`)
- `N8N_DATABASE_URL` — Connection to n8n database for workflow integration

### Deploy

`scripts/deploy-local.sh` handles local→VPS deploy:
1. Builds frontend locally (`npm run build`)
2. Syncs source via SSH (tar, excluding node_modules/dist/.git)
3. Runs `scripts/deploy-public-web.sh` on VPS
4. Validates `https://crm.enervita.com.br`

`scripts/sync-to-vps.sh` is a lighter alternative for just syncing files.

## Gotchas & Non-Obvious Patterns

1. **Repository interface pattern**: Every repository type has optional `close?()` method. The `app.ts` `onClose` hook calls `close()` on ALL repositories. When creating new repositories, always implement `close()` to end the pg Pool.

2. **Static repository fallbacks**: Some repositories have `createStatic*Repository()` variants (e.g., `createStaticAdsRepository`, `createStaticIntegrationsRepository`) that return no-op implementations. These are used when the app is started with a `userRepository` override (i.e., in tests or when integrations are not configured). Check `app.ts:60-62` for the conditional logic.

3. **`AuditContext` pattern**: Write operations pass `{ tenantId, actorUserId, ipAddress, userAgent }` extracted from the authenticated request. The `auditMetadata(request)` helper in route files captures this. All mutations write to `audit_logs` table.

4. **Tag normalization**: Tags are always lowercased and slugified (e.g., "VIP" → "vip", "Follow up" → "follow-up"). This happens in validation layer.

5. **`for update` locking**: Repository methods that modify leads use `select ... for update of l, c` to prevent race conditions during concurrent stage changes.

6. **Meta stage event debounce**: Manual stage changes queue CAPI events with `next_retry_at = now() + 10 minutes`. Before queuing, any existing queued events for the same lead are marked `discarded`. This prevents rapid-fire CAPI events during Kanban drag operations.

7. **Shared package exports raw `.ts`**: `@enervita/shared` exports TypeScript source directly (not compiled JS). Both API and web import `.ts` files. The package uses `"main": "./src/index.ts"`.

8. **PostgreSQL enums**: `lead_stage`, `priority_level`, `task_status`, `activity_type`, `delivery_status`, `permission_effect`, `proposal_status` — all defined in migration 001. When adding new enum values, add them in a new migration using `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

9. **No ORM**: All database access is raw SQL via `pg.Pool`/`pg.Client`. SQL queries use parameterized `$1, $2, ...` placeholders. Column mapping is done manually with SQL aliases (`as "camelCase"`) and row-to-object helper functions.

10. **Vite proxy in dev**: `apps/web/vite.config.ts` proxies `/api` to `http://127.0.0.1:4000`. In production, the `proxy` Docker service routes traffic. `preview.allowedHosts` must include production domains.

11. **Migration contract enforcement**: `npm run db:check` validates every table, column, enum, constraint and NOT NULL against `migration-contract.mjs`. When adding new schema objects, update the contract file or CI will fail. The `npm run test:migration` script validates the migration files themselves.

12. **Password hashing**: Uses `bcryptjs` (pure JS, no native deps). Test fixtures use `bcrypt.hashSync(password, 4)` with low cost factor for speed.
