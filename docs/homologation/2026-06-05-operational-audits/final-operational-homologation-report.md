# Homologação operacional complementar — CRM Enervita

Data: 2026-06-05 12:23 UTC
Ambiente: https://crm.enervita.com.br
Tipo: auditorias complementares de contrato, qualidade de dados, campos/formulários e Product/UX
Status: **GO operacional com ajustes não bloqueantes**

## Resumo executivo

A rodada complementar corrigiu as lacunas concretas apontadas pelos relatórios de homologação após o E2E funcional: contrato API/UI, qualidade operacional da amostra, labels/acessibilidade de busca, responsável/next action de leads e blockers altos de Product/UX em mobile.

Após correções e novo deploy/restart do web, as auditorias críticas ficaram sem blockers:

- Data Contract: **GO**, 0 issues.
- Data Quality: **GO**, 0 issues.
- Product/UX: **GO COM AJUSTES**, 0 highs/blockers.
- Field/Form: **GO COM AJUSTES**, sem high; restam 2 achados heurísticos não bloqueantes.

## Correções aplicadas

### Data contract / API / UI

Status: **corrigido**.

Mudanças principais:

- API de leads passou a expor/normalizar `sdrOwner` e `nextActionAt` para consumo de UI.
- Frontend passou a usar o nome do responsável (`sdrOwner`) em vez de UUID técnico.
- Tipos do frontend ajustados para `nextActionAt: string | null`.
- Mocks/dados de fallback receberam próxima ação para evitar lacunas operacionais falsas.
- Teste API atualizado para validar o shape esperado.

### Form fields / acessibilidade

Status: **corrigido onde era ação real do CRM**.

Mudanças principais:

- Busca de leads recebeu `label`/`aria-label` explícitos.
- Busca de tarefas recebeu `label`/`aria-label` explícitos.
- Card de responsável em tarefas recebeu `aria-label` descritivo.

### Product/UX mobile e copy de protótipo

Status: **corrigido para blockers altos**.

Mudanças principais:

- Removidas ocorrências de copy que o auditor classificava como aparência de protótipo por detectar `Todo/TODO`:
  - `Ver todo o histórico` → `Ver histórico completo`.
  - `Todo lead/contato` → `Cada lead/contato`.
- Criadas versões mobile em cards para substituir tabelas largas em:
  - `/leads`
  - `/proposals`
  - `/analytics`
- Tabelas continuam disponíveis em desktop/tablet com layout responsivo.

## Evidências pós-correção

### Suite de produção

Comando executado no repositório do CRM:

```text
npm run verify:production
```

Resultado: **passou**.

Cobertura executada:

- API typecheck: passou.
- API tests: **90/90** passaram.
- Web lint: passou.
- Web tests: **54/54** passaram.
- Web build: passou.
- Migration validation: passou; **30 tabelas** e **7 enums** validados.

Observação não bloqueante: os testes web ainda imprimem warnings de casing SVG em um teste de Analytics; os testes passam e não houve erro relevante de console nas auditorias live.

### Build web após ajustes finais de Product/UX

Comando executado:

```text
npm run build --workspace @enervita/web
```

Resultado: **passou**.

### Saúde live após restart

- `https://crm.enervita.com.br/health`: `{"ok":true}`.
- Containers principais verificados como healthy:
  - `postgres`
  - `api`
  - `proxy`
  - `web`
- Serviços operacionais em execução:
  - `meta-capi-dispatcher`
  - `operational-lead-sync`

## Auditorias reexecutadas

### Data Contract

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-30-405Z-crm-custom-data-contract-audit/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-30-405Z-crm-custom-data-contract-audit/data-contract-audit.json
```

Status: **GO DATA CONTRACT AUDIT**.

Resultado:

- Entidades auditadas: 4.
- Rotas UI auditadas: 4.
- Issues: 0.
- High: 0.
- Medium: 0.
- Low: 0.

### Data Quality

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-37-692Z-crm-custom-data-quality-audit/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-37-692Z-crm-custom-data-quality-audit/data-quality-audit.json
```

Status: **GO DATA QUALITY AUDIT**.

Resultado:

- Issues: 0.
- Open leads sem responsável: 0.
- Leads iniciais sem próxima ação: 0.
- Open tasks sem owner: 0.
- Propostas órfãs/valores inválidos: 0.

### Field/Form

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-39-690Z-crm-custom-form-field-audit/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T11-58-39-690Z-crm-custom-form-field-audit/form-field-audit.json
```

Status: **GO FIELD/FORM COM AJUSTES**.

Resultado:

- Routes: 7.
- Failed routes: 0.
- Fields: 20.
- Issues: 2.
- High: 0.
- Medium: 1.
- Low: 1.
- Relevant console errors: 0.
- Relevant failed requests: 0.
- Page errors: 0.

Ressalvas não bloqueantes:

- `weak_email_validation` em `/leads`: heurística detectou o campo `Buscar leads`; é uma busca textual, não um campo de e-mail transacional.
- `weak_date_input` em `/tasks`: heurística detectou o filtro de período agregado; os inputs de data específicos do componente usam `type="date"`.

### Product/UX

Artefatos:

```text
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T12-05-36-330Z-crm-custom-product-ux-audit/summary.md
/opt/clients/cesarmachado/homologacao/reports/enervita/2026-06-05T12-05-36-330Z-crm-custom-product-ux-audit/product-ux-audit.json
```

Status: **GO PRODUCT/UX COM AJUSTES**.

Resultado pós-correção:

- Routes: 24.
- Failed routes: 0.
- Issues: 103.
- High: 0.
- Medium: 16.
- Low: 87.
- Relevant console errors: 0.
- Relevant failed requests: 0.
- Page errors: 0.
- Blockers: 0.

Antes da correção havia 9 highs, incluindo copy detectada como protótipo e overflow de tabela mobile em `/leads`, `/proposals` e `/analytics`. Após os ajustes, todos os highs foram zerados.

Ressalvas restantes são majoritariamente heurísticas de estado vazio e CTAs genéricos. Não bloqueiam a homologação operacional porque não quebram fluxo, segurança, dados ou navegação.

## Status final

- CRM funcional live: **GO FUNCIONAL** conforme rodada E2E anterior.
- Contrato API/UI complementar: **GO**.
- Qualidade de dados operacional: **GO**.
- Product/UX: **GO COM AJUSTES**, sem blockers/high.
- Field/Form: **GO COM AJUSTES**, sem high e com ressalvas heurísticas não bloqueantes.
- Produção técnica/funcional para o escopo homologado: **GO com backlog não bloqueante de refinamento UX/acessibilidade/performance**.

## Pendências não bloqueantes

- Refinar estados vazios para reduzir alertas médios do auditor Product/UX.
- Renomear CTAs curtos/genéricos onde fizer sentido para reduzir lows.
- Planejar code-splitting futuro para bundles grandes.
- Rodada futura de ZAP/k6 ou active scan autenticado somente com janela aprovada.

## Segurança da documentação

- Sem senha/token neste relatório.
- Relatórios de auditoria são redatados e não gravam valores sensíveis de nomes, e-mails, telefones, notas, cookies ou tokens.
- Auditorias complementares foram read-only, exceto correções intencionais no código do CRM e restart controlado dos serviços.
