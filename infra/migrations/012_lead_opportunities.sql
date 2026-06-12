-- P1.3 — Conversão Lead → Oportunidade
-- Cria uma oportunidade comercial rastreável vinculada ao lead.

create table if not exists lead_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  expected_value numeric(12,2),
  probability integer not null default 30,
  converted_by uuid references users(id) on delete set null,
  converted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_opportunities_lead_unique unique (tenant_id, lead_id),
  constraint lead_opportunities_status_check check (status in ('open', 'won', 'lost')),
  constraint lead_opportunities_probability_check check (probability between 0 and 100)
);

create index if not exists lead_opportunities_tenant_status_idx on lead_opportunities (tenant_id, status, converted_at desc);
create index if not exists lead_opportunities_lead_idx on lead_opportunities (tenant_id, lead_id);
