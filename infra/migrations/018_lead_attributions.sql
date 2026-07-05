create table if not exists lead_attributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null,
  source_system text not null,
  source_channel text not null,
  leadgen_id text,
  form_id text,
  form_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbp text,
  fbc text,
  fbclid text,
  gclid text,
  raw_event_id uuid,
  confidence text not null default 'partial',
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_attributions_lead_unique unique (tenant_id, lead_id),
  constraint lead_attributions_lead_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade
);

create index if not exists lead_attributions_tenant_source_idx on lead_attributions (tenant_id, source_system, source_channel);
create index if not exists lead_attributions_tenant_leadgen_idx on lead_attributions (tenant_id, leadgen_id) where leadgen_id is not null;
create index if not exists lead_attributions_tenant_campaign_idx on lead_attributions (tenant_id, campaign_id) where campaign_id is not null;

insert into schema_migrations (version, description)
values ('018_lead_attributions', 'Canonical lead attribution records for Meta and future lead sources')
on conflict (version) do nothing;
