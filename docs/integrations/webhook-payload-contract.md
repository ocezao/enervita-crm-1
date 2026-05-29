# Contrato de payload - CRM preview -> n8n

Este contrato cobre a homologação controlada do dispatcher de webhooks do CRM custom da Enervita.

Escopo:
- Ambiente: preview isolado em `/opt/clients/enervita-crm-preview`.
- Destino: n8n dedicado da Enervita em `n8n.enervita.com.br`.
- Workflow de homologação: `env-crm-preview-webhook-homologacao` / `Enervita | CRM Preview Webhook Homologacao`.
- Produção Twenty (`crm.enervita.com.br`) não participa deste fluxo.
- Todos os payloads de homologação devem enviar `homologation: true` e dados sintéticos.

## Regras gerais

Todo evento enviado pelo dispatcher deve usar JSON com estes campos mínimos:

```json
{
  "event_type": "lead.created",
  "event_id": "crm-preview-5k-YYYYMMDDHHMMSS-lead-created",
  "homologation": true,
  "source": "crm-preview",
  "occurred_at": "2026-05-29T14:29:59.000-03:00"
}
```

Regras:
- `event_type` é obrigatório e define o tipo lógico do evento.
- `event_id` deve ser idempotente por evento.
- `homologation: true` identifica que não é fluxo comercial real.
- Não enviar tokens, cookies, senhas, `DATABASE_URL`, headers de autorização ou dados pessoais reais.
- O dispatcher só pode chamar hosts HTTPS explicitamente permitidos por allowlist.

## Eventos homologados

### `lead.created`

Destino atual: `https://n8n.enervita.com.br/webhook/lead-created`

Campos esperados:

```json
{
  "event_type": "lead.created",
  "event_id": "crm-preview-5k-YYYYMMDDHHMMSS-lead-created",
  "homologation": true,
  "source": "crm-preview",
  "occurred_at": "ISO-8601",
  "lead": {
    "id": "synthetic-lead-5k",
    "stage": "NEW",
    "source": "homologacao-dispatcher"
  },
  "contact": {
    "name": "Lead Sintetico Homologacao"
  }
}
```

### `lead.stage_changed`

Destino atual: `https://n8n.enervita.com.br/webhook/lead-stage-changed`

Campos esperados:

```json
{
  "event_type": "lead.stage_changed",
  "event_id": "crm-preview-5k-YYYYMMDDHHMMSS-stage-changed",
  "homologation": true,
  "source": "crm-preview",
  "occurred_at": "ISO-8601",
  "lead": {
    "id": "synthetic-lead-5k"
  },
  "stage_change": {
    "from": "NEW",
    "to": "PROPOSAL"
  }
}
```

### `proposal.open_48h`

Destino atual: `https://n8n.enervita.com.br/webhook/lead-stage-changed`

Observação: nesta homologação o evento usa o webhook ativo de mudança de etapa porque o cadastro operacional de webhooks do preview agrupa `proposal.open_48h` no mesmo destino de n8n.

Campos esperados:

```json
{
  "event_type": "proposal.open_48h",
  "event_id": "crm-preview-5k-YYYYMMDDHHMMSS-proposal-open-48h",
  "homologation": true,
  "source": "crm-preview",
  "occurred_at": "ISO-8601",
  "lead": {
    "id": "synthetic-lead-5k"
  },
  "proposal": {
    "id": "synthetic-proposal-5k",
    "status": "sent",
    "open_hours": 48
  }
}
```

### `webhook.test`

Destino atual: `https://n8n.enervita.com.br/webhook/lead-created` ou `https://n8n.enervita.com.br/webhook/webhook-test` para smoke direto.

Campos esperados:

```json
{
  "event_type": "webhook.test",
  "event_id": "crm-preview-5k-YYYYMMDDHHMMSS-webhook-test",
  "homologation": true,
  "source": "crm-preview",
  "occurred_at": "ISO-8601",
  "diagnostic": {
    "purpose": "dispatcher-smoke"
  }
}
```

## Critério de aceite da Fase 5K

A homologação é considerada OK quando:

1. O workflow `env-crm-preview-webhook-homologacao` está ativo no n8n dedicado.
2. Os paths diretos respondem HTTP 200:
   - `/webhook/lead-created`
   - `/webhook/lead-stage-changed`
   - `/webhook/proposal-open-48h`
   - `/webhook/webhook-test`
3. O dispatcher roda com `WEBHOOK_DISPATCH_ALLOWED_HOSTS=n8n.enervita.com.br`.
4. As entregas sintéticas em `webhook_deliveries` mudam de `queued` para `sent`.
5. Cada entrega registra `http_status=200`, `attempts=1` e response body redigido/seguro.
6. `execution_entity` no n8n registra execuções `success` do workflow de homologação.

## Comando operacional usado na homologação

O dispatcher deve ser executado sem imprimir `DATABASE_URL` ou segredos:

```bash
WEBHOOK_DISPATCH_ALLOWED_HOSTS=n8n.enervita.com.br \
WEBHOOK_DISPATCH_LIMIT=10 \
# DATABASE_URL já injetado no ambiente, sem imprimir valor
npm run dispatch:webhooks --workspace @enervita/api
```

Resultado esperado para 4 eventos sintéticos:

```json
{"ok":true,"allowedHostsConfigured":1,"processed":4,"sent":4,"failed":0,"blocked":0}
```

