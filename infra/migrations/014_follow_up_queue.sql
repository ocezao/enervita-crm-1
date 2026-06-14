create table if not exists follow_up_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  rule_key text not null,
  channel text not null default 'manual',
  reason text not null,
  status text not null default 'pending',
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  skipped_at timestamptz,
  failed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_queue_status_check check (status in ('pending', 'sent', 'skipped', 'failed', 'cancelled')),
  constraint follow_up_queue_channel_check check (channel in ('manual', 'whatsapp', 'email')),
  constraint follow_up_queue_idempotency_unique unique (tenant_id, idempotency_key)
);

create index if not exists follow_up_queue_tenant_status_scheduled_idx on follow_up_queue (tenant_id, status, scheduled_at);
create index if not exists follow_up_queue_tenant_lead_status_idx on follow_up_queue (tenant_id, lead_id, status);
create index if not exists follow_up_queue_tenant_rule_created_idx on follow_up_queue (tenant_id, rule_key, created_at desc);
