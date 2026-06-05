# Homologação funcional/operacional — CRM Enervita

Data: 2026-06-04 09:35 UTC
Ambiente: https://crm.enervita.com.br
Tipo: funcional/operacional com dados sintéticos controlados e evidência redatada
Status: **GO para homologação técnica/funcional atual**

## Resumo executivo

O bloqueio F-001 de logout/session replay foi corrigido e retestado. A API agora rejeita replay manual do cookie antigo após `POST /api/auth/logout`.

A rodada pós-correção passou em testes automatizados, build, schema check, smoke autenticado desktop/mobile e E2E funcional live com dados sintéticos e cleanup verificado.

## Correção aplicada

### F-001 — Logout não invalidava cookie antigo no servidor

Status: **corrigido**.

Mudanças principais:

- Token de sessão passou a carregar `iat`.
- Backend passou a consultar revogação de sessão por usuário antes de aceitar `/api/me` e rotas autenticadas.
- `POST /api/auth/logout` agora registra revogação server-side além de limpar o cookie do browser.
- Repositório Postgres grava `sessionRevokedAtEpoch` em metadata do usuário em milissegundos via `clock_timestamp()`.
- Teste de regressão adicionado: login → capturar cookie → logout → replay manual do cookie antigo em `/api/me` deve retornar 401.

## Evidências pós-correção

### Testes automatizados

- API typecheck: passou.
- API tests: **87/87** passaram.
- DB schema check: passou; **30 tabelas CRM** validadas com `DATABASE_URL` explícita do compose.
- Web targeted tests: **24/24** passaram.
- Web build: passou.

Observação não bloqueante: Vite ainda alerta bundle JS > 500 kB; recomenda code-splitting depois, mas não bloqueia homologação funcional.

### E2E funcional live

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-04T09-15-35-950Z-crm-custom-functional-e2e/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-04T09-15-35-950Z-crm-custom-functional-e2e/functional-e2e.json
```

Status: **GO FUNCIONAL**.

Passou:

- Login admin.
- `/api/me` autenticado.
- Logout admin.
- Replay manual do cookie antigo rejeitado: HTTP 401.
- Re-login após probe de replay.
- Criação de lead sintético.
- Tag e filtro por tag QA.
- Abertura de detalhe do lead.
- Alteração de etapa para `qualificacao`.
- Edição de campos do lead.
- Criação/listagem/conclusão de tarefa.
- Criação/listagem de atividade/timeline.
- Criação/listagem de proposta.
- Consulta de tracking events não-Google.
- Cleanup: lead sintético removido e verificado com HTTP 404.

### UI smoke autenticado com browser

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-04T09-32-06-672Z-crm-custom/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-04T09-32-06-672Z-crm-custom/report.json
```

Status: **GO TÉCNICO MVP**.

Resultado:

- 14 páginas/visões testadas em desktop e mobile.
- Rotas com falha: 0.
- Erros de console: 0.
- Erros de console relevantes: 0.
- Requests falhos totais: 6.
- Requests falhos relevantes: 0.
- Aborts de navegação ignorados: 6.
- Page errors: 0.
- Lighthouse login:
  - Performance: 96.
  - Accessibility: 93.
  - Best Practices: 96.
  - SEO: 82.
- Pa11y login: 6 errors.

### Saúde live

- `https://crm.enervita.com.br/health`: OK.
- Containers `api`, `web`, `proxy`, `postgres`: healthy.
- `operational-lead-sync` e `meta-capi-dispatcher`: em execução.

## Pendências não bloqueantes

- Pa11y ainda aponta 6 erros na tela de login; tratar como backlog de acessibilidade/UX.
- Bundle JS grande no build web; recomenda code-splitting.
- Runner de smoke foi ajustado de `networkidle` para `domcontentloaded` para evitar travamento por conexões persistentes em SPA; reteste passou.
- ZAP baseline/passive anterior pós-hardening estava GO passivo com apenas informacionais; não foi reexecutado nesta rodada pós-logout.
- Não equivale a pentest nem active scan autenticado.

## Status final

- CRM funcional live: **GO FUNCIONAL**.
- UI smoke autenticado: **GO TÉCNICO MVP**.
- Segurança de sessão/logout: **GO após correção**.
- Produção definitiva: **GO técnico/funcional para o escopo homologado**, com pendências não bloqueantes de acessibilidade, performance/code-splitting e eventual rodada futura de ZAP/k6 com janela aprovada.

## Segurança da documentação

- Sem senha/token no relatório.
- Dados funcionais foram sintéticos com domínio `example.invalid`.
- Cleanup verificado ao final.
