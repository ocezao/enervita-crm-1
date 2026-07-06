# Plano de Correção de Código - Auditoria TypeScript

## Resumo da Auditoria

Foram identificados os seguintes problemas no código:

### 1. Uso excessivo de `as any` (8 ocorrências)
- `/workspace/apps/api/src/modules/solar/dimensioning.routes.ts`: linhas 128, 271
- `/workspace/apps/api/src/modules/ai/ai.service.ts`: linhas 131, 160, 167
- `/workspace/apps/web/src/pages/LeadDetail.tsx`: linhas 761, 762
- `/workspace/apps/web/src/pages/Settings.tsx`: linha 135

### 2. TODOs não implementados (2 ocorrências)
- `/workspace/apps/api/src/modules/leads/repository.ts`: linhas 759, 765
  - TODO: filtrar por prioridade do lead
  - TODO: filtrar por valor da conta

### 3. Error handling silencioso (13 ocorrências de `.catch(() => {})`)
- `/workspace/apps/api/src/modules/leads/repository.ts`: linhas 1227, 1341
- `/workspace/apps/api/src/modules/ai/ai.service.ts`: linha 140
- `/workspace/apps/api/src/modules/notifications/repository.ts`: linha 534
- `/workspace/apps/api/src/db/seedAdmin.ts`: linha 184
- `/workspace/apps/web/src/pages/Settings.tsx`: linhas 140, 150, 181
- `/workspace/apps/web/tests/e2e/ui-validation.spec.ts`: linhas 190, 356, 359, 362, 365

### 4. Console.log em produção (8 ocorrências)
- `/workspace/apps/api/src/server.ts`: linha 9 (aceitável - startup)
- `/workspace/apps/api/src/db/seedAdmin.ts`: linhas 113, 172 (aceitável - seed script)
- `/workspace/apps/api/scripts/auto-reassign.ts`: linha 357 (script)
- `/workspace/apps/api/scripts/run-notification-rules.ts`: linha 32 (script)
- `/workspace/apps/api/scripts/dispatch-webhooks.ts`: linha 23 (script)
- `/workspace/apps/api/scripts/dispatch-meta-capi.ts`: linha 18 (script)
- `/workspace/scripts/sync-meta-verify.ts`: linha 19 (script)

---

## Fases de Correção

### FASE 1: Substituir `as any` por tipos adequados
**Prioridade:** Alta
**Impacto:** Melhora a segurança de tipo e previne erros em runtime

#### 1.1 - dimensioning.routes.ts (linhas 128, 271)
- Criar interfaces para os bodies das requisições
- Substituir `request.body as any` por tipagem adequada

#### 1.2 - ai.service.ts (linhas 131, 160, 167)
- Linha 131: Tipar corretamente o import dinâmico de playwright
- Linha 160: Remover cast desnecessário para provider
- Linha 167: Tipar corretamente allowedStages

#### 1.3 - LeadDetail.tsx (linhas 761, 762)
- Usar setState ou callback adequado para atualizar o lead
- Evitar mutação direta com cast para any

#### 1.4 - Settings.tsx (linha 135)
- Tipar corretamente o objeto de configuração

---

### FASE 2: Implementar TODOs pendentes
**Prioridade:** Média
**Impacto:** Funcionalidades incompletas podem causar comportamento inesperado

#### 2.1 - repository.ts (linhas 759, 765)
- Implementar lógica de filtragem por prioridade do lead
- Implementar lógica de filtragem por valor da conta

---

### FASE 3: Melhorar error handling
**Prioridade:** Alta
**Impacto:** Erros silenciosos dificultam debugging e podem esconder problemas críticos

#### 3.1 - leads.repository.ts (linhas 1227, 1341)
- Adicionar logging ou tratamento adequado para erros do calculateQualificationScore

#### 3.2 - ai.service.ts (linha 140)
- Adicionar logging para falhas no page.goto

#### 3.3 - notifications/repository.ts (linha 534)
- Adicionar logging para falhas no rollback

#### 3.4 - seedAdmin.ts (linha 184)
- Manter silencioso (é aceitável para cleanup)

#### 3.5 - Settings.tsx (linhas 140, 150, 181)
- Adicionar feedback visual ou logging para erros

#### 3.6 - ui-validation.spec.ts (linhas 190, 356, 359, 362, 365)
- Manter silencioso em testes é aceitável, mas pode melhorar com comentários

---

### FASE 4: Revisar console.log
**Prioridade:** Baixa
**Impacto:** Logs inadequados podem poluir output em produção

#### 4.1 - Verificar se todos os console.log estão em scripts ou inicialização
- Todos identificados estão em contextos apropriados (scripts, seed, startup)
- Nenhum precisa ser removido

---

## Cronograma Estimado

- **Fase 1:** 2-3 horas
- **Fase 2:** 1-2 horas
- **Fase 3:** 2-3 horas
- **Fase 4:** 0.5 hora (apenas revisão)

**Total estimado:** 5.5-8.5 horas

---

## Critérios de Aceite

Cada correção deve:
1. Passar no typecheck do TypeScript sem erros
2. Manter ou melhorar a cobertura de testes existente
3. Seguir as convenções de código do projeto
4. Ser verificada individualmente antes de prosseguir para a próxima

---

## Notas Importantes

- Todas as alterações devem ser commitadas incrementalmente
- Cada fase deve ser testada isoladamente
- Mudanças quebradoras devem ser documentadas no CHANGELOG
