-- Controlled integrations execution for CRM preview.
-- Seeds internal automation/webhook records used to create runs and queued delivery logs without outbound HTTP.

insert into automation_rules (id, tenant_id, name, trigger, conditions, actions, active)
select '44444444-0001-4000-8000-000000000001'::uuid,
       t.id,
       'Alerta de lead sem follow-up em 12h',
       'lead.no_followup_12h',
       '["Lead em etapas comerciais sem atividade recente", "Sem tarefa aberta para o responsável"]'::jsonb,
       '["Criar tarefa urgente para SDR", "Notificar responsável comercial"]'::jsonb,
       true
  from tenants t
on conflict (tenant_id, name) do update
   set trigger = excluded.trigger,
       conditions = excluded.conditions,
       actions = excluded.actions,
       active = excluded.active,
       updated_at = now();

insert into automation_rules (id, tenant_id, name, trigger, conditions, actions, active)
select '44444444-0002-4000-8000-000000000002'::uuid,
       t.id,
       'Retorno de proposta aberta em 48h',
       'proposal.open_48h',
       '["Lead na etapa proposta_enviada", "Sem atividade de retorno registrada"]'::jsonb,
       '["Criar tarefa de follow-up", "Sugerir mensagem WhatsApp"]'::jsonb,
       true
  from tenants t
on conflict (tenant_id, name) do update
   set trigger = excluded.trigger,
       conditions = excluded.conditions,
       actions = excluded.actions,
       active = excluded.active,
       updated_at = now();

insert into webhooks (id, tenant_id, name, url, event_types, status, success_rate)
select '55555555-0001-4000-8000-000000000001'::uuid,
       t.id,
       'n8n - lead criado',
       'https://n8n.enervita.com.br/webhook/lead-created',
       array['lead.created', 'lead.no_followup_12h', 'automation.run', 'webhook.test'],
       'active',
       0
  from tenants t
on conflict (tenant_id, name) do update
   set url = excluded.url,
       event_types = excluded.event_types,
       status = excluded.status,
       updated_at = now();

insert into webhooks (id, tenant_id, name, url, event_types, status, success_rate)
select '55555555-0002-4000-8000-000000000002'::uuid,
       t.id,
       'n8n - mudança de etapa',
       'https://n8n.enervita.com.br/webhook/lead-stage-changed',
       array['lead.stage_changed', 'proposal.open_48h', 'automation.run', 'webhook.test'],
       'active',
       0
  from tenants t
on conflict (tenant_id, name) do update
   set url = excluded.url,
       event_types = excluded.event_types,
       status = excluded.status,
       updated_at = now();

insert into schema_migrations (version, description)
values ('004_controlled_integrations', 'Controlled automation runs and webhook queue seeds')
on conflict (version) do nothing;
