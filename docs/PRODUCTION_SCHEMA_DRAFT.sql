-- Draft inicial de schema PostgreSQL para transformar o protótipo do CRM Enervita em aplicação real.
-- Revisar nomes, enums e integrações antes de aplicar em produção.

create extension if not exists pgcrypto;

create type lead_stage as enum (
  'novo_lead',
  'qualificacao',
  'atendimento_iniciado',
  'conta_recebida',
  'diagnostico',
  'proposta_enviada',
  'contrato_enervita',
  'perdido'
);

create type priority_level as enum ('baixa', 'media', 'alta', 'urgente');
create type task_status as enum ('pendente', 'concluido', 'atrasado', 'cancelado');
create type activity_type as enum ('call', 'email', 'whatsapp', 'meeting', 'note', 'stage_change');
create type delivery_status as enum ('queued', 'sent', 'failed');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  cnpj text,
  status text not null default 'active',
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  source text,
  consent boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete restrict,
  stage lead_stage not null default 'novo_lead',
  qualification_status text,
  lead_source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbp text,
  fbc text,
  fbclid text,
  gclid text,
  estimated_ticket numeric(14,2),
  sdr_owner_id uuid references users(id) on delete set null,
  first_response_at timestamptz,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  notes text,
  energy_bill_value numeric(14,2),
  average_consumption_kwh numeric(14,2),
  concessionaria text,
  offer text,
  projected_savings numeric(14,2),
  priority priority_level not null default 'media',
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_tenant_stage_idx on leads(tenant_id, stage);
create index leads_owner_next_action_idx on leads(sdr_owner_id, next_action_at);
create index leads_created_at_idx on leads(created_at desc);

create table lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_stage lead_stage,
  to_stage lead_stage not null,
  changed_by uuid references users(id) on delete set null,
  changed_at timestamptz not null default now(),
  notes text
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  title text not null,
  status task_status not null default 'pendente',
  priority priority_level not null default 'media',
  owner_id uuid references users(id) on delete set null,
  due_date timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_owner_status_due_idx on tasks(owner_id, status, due_date);

create table activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  activity_type activity_type not null,
  outcome text,
  response_time_seconds integer,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index activities_lead_occurred_idx on activities(lead_id, occurred_at desc);

create table tracking_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  platform text not null,
  event_name text not null,
  status delivery_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  sent_at timestamptz,
  next_retry_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references automation_rules(id) on delete cascade,
  status text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  url text not null,
  event_types text[] not null default '{}',
  secret_hash text,
  status text not null default 'active',
  success_rate numeric(5,2) not null default 0,
  last_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status delivery_status not null default 'queued',
  http_status integer,
  response_body text,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table sync_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_system text not null,
  source_table text,
  source_id text not null,
  target_system text not null,
  target_object text,
  target_id text not null,
  last_synced_at timestamptz not null default now(),
  unique(source_system, source_id, target_system, target_id)
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  source text,
  ip_address inet,
  user_agent text,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table integration_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  label text not null,
  encrypted_secret text not null,
  scopes text[] not null default '{}',
  status text not null default 'active',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
