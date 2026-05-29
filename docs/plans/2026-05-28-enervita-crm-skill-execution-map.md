# Enervita CRM — Skill Execution Map

Objetivo: definir quais habilidades Hermes serão usadas para executar o plano de produção do CRM Enervita com eficiência, persistência, qualidade e segurança operacional.

Plano base:
`docs/plans/2026-05-28-enervita-crm-production-implementation.md`

## Skills principais

### 1. writing-plans

Uso:
- Manter o plano de implementação detalhado, com tarefas pequenas e verificáveis.
- Atualizar o plano quando o escopo mudar.
- Registrar caminhos, comandos, critérios de aceite e checkpoints.

Onde entra:
- Antes de iniciar execução.
- Ao quebrar tarefas grandes demais.
- Quando surgir decisão arquitetural nova.

Status:
- Já usado para criar o plano principal.

### 2. subagent-driven-development

Uso:
- Executar o plano tarefa por tarefa com subagentes especializados.
- Usar um subagente implementador por tarefa.
- Usar revisão em duas fases:
  1. revisão de conformidade com a especificação;
  2. revisão de qualidade/código/segurança.

Onde entra:
- Fase 1 a Fase 8.
- Especialmente backend, auth, permissões, API real e deploy.

Gates:
- Pre-flight: confirmar plano, repo, dependências e ambiente.
- Revision: revisar cada entrega antes de avançar.
- Escalation: chamar Cesar se houver ambiguidade que mude arquitetura/permissão/domínio.
- Abort: parar se houver risco de segredo exposto, ação destrutiva não aprovada ou contexto degradado demais.

### 3. test-driven-development

Uso:
- Criar testes antes de código para auth, permissões, CRUD, stage permissions, tasks, activities e webhooks.
- Evitar implementar backend crítico sem teste.

Onde entra:
- API base.
- Login/logout/me.
- requireAuth.
- requirePermission.
- criação de usuários por admin.
- permissões por página/função/etapa.
- leads/contacts/tasks/activities.
- dashboard real.

Regra:
- Para comportamento novo crítico: primeiro teste falhando, depois implementação, depois teste passando.

### 4. requesting-code-review

Uso:
- Revisão pré-commit e pré-deploy.
- Scan de segredos e problemas de segurança.
- Verificação de lint/build/test.
- Revisor independente para evitar autoaprovação.

Onde entra:
- Após tarefas com 2+ arquivos modificados.
- Antes de commits importantes.
- Antes de subir para VPS.
- Antes de expor preview.

Checks:
- Sem secrets hardcoded.
- SQL parametrizado.
- Sem bypass de autenticação/autorização.
- Sem endpoints sensíveis sem permission guard.
- Lint/build/test passando.

### 5. systematic-debugging

Uso:
- Resolver bugs sem chute.
- Investigar falhas de teste, build, Docker, Caddy, API, banco ou permissão.

Onde entra:
- Quando qualquer check falhar.
- Quando integração web/api/db tiver comportamento inesperado.
- Quando deploy na VPS não responder.

Processo:
- Ler erro completo.
- Reproduzir.
- Rastrear fluxo.
- Isolar causa.
- Criar teste/regressão.
- Corrigir uma causa por vez.

### 6. agencia-vps-ssh

Uso:
- Operar VPS com SSH seguro.
- Não imprimir secrets.
- Usar alias `agencia-vps`.
- Verificar Docker, Caddy, containers e healthchecks.
- Subir preview em `/opt/clients/enervita-crm-preview`.

Onde entra:
- Fase 0.2.
- Fase 7 inteira.
- Smoke tests na VPS.
- Se precisar configurar subdomínio/preview protegido.

Regras:
- Não usar `crm.enervita.com.br` para preview sem aprovação explícita.
- Não expor `.env`, tokens, passwords, DATABASE_URL ou inspect de env completo.
- Primeiro rodar localmente na VPS e validar por `curl 127.0.0.1`.

## Skills auxiliares opcionais

### github-pr-workflow

Usar somente se o projeto virar repositório GitHub com branch, PR, CI e merge.
Não é necessário para o primeiro preview local/VPS.

### github-auth

Usar somente se houver problema de autenticação GitHub ou se for necessário criar/usar repo remoto.

### codebase-inspection

Útil se o projeto crescer muito e precisarmos medir estrutura, linguagem, LOC e complexidade antes de refatorar.

### obsidian

Usar se Cesar quiser registrar a decisão/arquitetura no vault Enervita/Veles.
Não é obrigatório para implementar.

### native-mcp / n8n

Usar depois, quando for conectar webhooks/automações reais com n8n.
Não é prioridade antes de auth, banco e API real.

## Mapeamento por fase

| Fase | Skills principais | Motivo |
| --- | --- | --- |
| 0 Preparação/backup | writing-plans, agencia-vps-ssh, requesting-code-review | preservar estado, checar VPS, evitar risco |
| 1 Estrutura/lint | subagent-driven-development, requesting-code-review, systematic-debugging | reorganizar com revisão e corrigir falhas |
| 2 Banco/migrations | test-driven-development, requesting-code-review, systematic-debugging | schema precisa ser verificável e seguro |
| 3 API/auth | test-driven-development, subagent-driven-development, requesting-code-review | autenticação é crítica e precisa de testes |
| 4 Admin/permissões | test-driven-development, subagent-driven-development, requesting-code-review | permissão precisa ser server-side e revisada |
| 5 API real/CRUD | test-driven-development, subagent-driven-development | substituir mock sem regressões |
| 6 Dashboard/webhooks/automações | test-driven-development, systematic-debugging | integrações e filas exigem testes/debug |
| 7 VPS/deploy preview | agencia-vps-ssh, systematic-debugging, requesting-code-review | operação segura, healthchecks e sem secrets |
| 8 QA | requesting-code-review, test-driven-development, systematic-debugging | gates finais e smoke test |
| 9 Go/No-Go | writing-plans, requesting-code-review, agencia-vps-ssh | relatório final fundamentado |

## Estratégia de execução eficiente e persistente

1. Não executar tudo em uma tacada só.
2. Criar checkpoints por fase.
3. Commitar após unidades estáveis.
4. Usar subagente implementador por tarefa, com contexto específico.
5. Usar revisor separado para spec e qualidade.
6. Rodar lint/build/test antes de mover para próxima fase.
7. Registrar decisões no plano quando escopo mudar.
8. No deploy, validar primeiro localmente na VPS.
9. Só expor preview com proteção.
10. Se contexto ficar pesado, checkpointar e continuar em nova etapa.

## Gates obrigatórios

### Gate A — Pre-flight local

Antes de implementar:
- Plano existe.
- Repo/versionamento pronto.
- Build atual conhecido.
- Lint atual conhecido.
- Nenhum segredo exposto.

### Gate B — Pre-flight VPS

Antes de subir:
- SSH `agencia-vps` OK.
- Docker OK.
- Pasta alvo definida.
- Preview não conflita com serviços atuais.
- Não usa `crm.enervita.com.br` sem aprovação.

### Gate C — Revision por tarefa

Após cada tarefa:
- Spec review PASS.
- Code quality review APPROVED.
- Testes relevantes passam.

### Gate D — Security/Auth

Antes de expor preview:
- Rotas sensíveis exigem login.
- Cadastro público inexistente.
- Funcionário sem permissão recebe 403/redirect.
- Admin consegue revogar acesso.
- Nenhum secret em logs/chat.

### Gate E — Deploy preview

Antes de entregar URL/porta para Cesar:
- API health OK.
- Web responde.
- Login admin OK.
- Persistência OK após refresh.
- Containers saudáveis.

## Conclusão

As skills carregadas são suficientes para executar o plano com qualidade:

- `writing-plans` mantém o plano vivo.
- `subagent-driven-development` dá execução persistente por tarefas.
- `test-driven-development` reduz risco em auth/permissões/API.
- `requesting-code-review` cria barreira de segurança/qualidade.
- `systematic-debugging` evita chute quando algo falhar.
- `agencia-vps-ssh` protege a operação na VPS e evita exposição de secrets.

A recomendação é executar usando essas skills como protocolo obrigatório, não como referência informal.
