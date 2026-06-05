-- Initial PostgreSQL schema for Enervita CRM.
-- Idempotent for local/dev re-runs; review separately before production use.

create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  description text not null,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
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
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'priority_level') then
    create type priority_level as enum ('baixa', 'media', 'alta', 'urgente');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('pendente', 'concluido', 'atrasado', 'cancelado');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type activity_type as enum ('call', 'email', 'whatsapp', 'meeting', 'note', 'stage_change');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type delivery_status as enum ('queued', 'sent', 'failed', 'discarded');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'permission_effect') then
    create type permission_effect as enum ('allow', 'deny');
  end if;
end $$;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  cnpj text,
  status text not null default 'active',
  website_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text not null,
  password_hash text,
  status text not null default 'active',
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_tenant_email_unique unique (tenant_id, email),
  constraint users_id_tenant_unique unique (id, tenant_id)
);

create unique index if not exists users_global_email_unique_idx on users (lower(email));

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_tenant_name_unique unique (tenant_id, name),
  constraint roles_id_tenant_unique unique (id, tenant_id)
);

create table if not exists user_roles (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  role_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  primary key (tenant_id, user_id, role_id),
  constraint user_roles_user_tenant_fk foreign key (user_id, tenant_id) references users(id, tenant_id) on delete cascade,
  constraint user_roles_role_tenant_fk foreign key (role_id, tenant_id) references roles(id, tenant_id) on delete cascade,
  constraint user_roles_assigned_by_tenant_fk foreign key (assigned_by, tenant_id) references users(id, tenant_id) on delete set null (assigned_by)
);

create table if not exists employee_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  employee_code text,
  department text,
  job_title text,
  manager_user_id uuid,
  hire_date date,
  termination_date date,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profiles_user_unique unique (user_id),
  constraint employee_profiles_tenant_user_unique unique (user_id, tenant_id),
  constraint employee_profiles_tenant_code_unique unique (tenant_id, employee_code),
  constraint employee_profiles_user_tenant_fk foreign key (user_id, tenant_id) references users(id, tenant_id) on delete cascade,
  constraint employee_profiles_manager_tenant_fk foreign key (manager_user_id, tenant_id) references users(id, tenant_id) on delete set null (manager_user_id)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint permissions_resource_action_unique unique (resource, action)
);

create table if not exists user_permissions (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  permission_id uuid not null references permissions(id) on delete cascade,
  effect permission_effect not null default 'allow',
  scope jsonb not null default '{}'::jsonb,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (tenant_id, user_id, permission_id),
  constraint user_permissions_user_tenant_fk foreign key (user_id, tenant_id) references users(id, tenant_id) on delete cascade,
  constraint user_permissions_granted_by_tenant_fk foreign key (granted_by, tenant_id) references users(id, tenant_id) on delete set null (granted_by)
);

create table if not exists stage_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  role_id uuid not null,
  permission_id uuid not null references permissions(id) on delete cascade,
  stage lead_stage not null,
  effect permission_effect not null default 'allow',
  created_at timestamptz not null default now(),
  constraint stage_permissions_role_permission_stage_unique unique (tenant_id, role_id, permission_id, stage),
  constraint stage_permissions_role_tenant_fk foreign key (role_id, tenant_id) references roles(id, tenant_id) on delete cascade
);

create table if not exists contacts (
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
  updated_at timestamptz not null default now(),
  constraint contacts_id_tenant_unique unique (id, tenant_id)
);

create index if not exists contacts_tenant_email_idx on contacts(tenant_id, lower(email));
create index if not exists contacts_tenant_phone_idx on contacts(tenant_id, phone);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null,
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
  sdr_owner_id uuid,
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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_id_tenant_unique unique (id, tenant_id),
  constraint leads_contact_tenant_fk foreign key (contact_id, tenant_id) references contacts(id, tenant_id) on delete restrict,
  constraint leads_sdr_owner_tenant_fk foreign key (sdr_owner_id, tenant_id) references users(id, tenant_id) on delete set null (sdr_owner_id)
);

create index if not exists leads_tenant_stage_idx on leads(tenant_id, stage);
create index if not exists leads_owner_next_action_idx on leads(sdr_owner_id, next_action_at);
create index if not exists leads_created_at_idx on leads(created_at desc);

create table if not exists lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null,
  from_stage lead_stage,
  to_stage lead_stage not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  notes text,
  constraint lead_stage_history_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint lead_stage_history_changed_by_tenant_fk foreign key (changed_by, tenant_id) references users(id, tenant_id) on delete set null (changed_by)
);

create index if not exists lead_stage_history_lead_changed_idx on lead_stage_history(lead_id, changed_at desc);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid,
  title text not null,
  description text,
  status task_status not null default 'pendente',
  priority priority_level not null default 'media',
  owner_id uuid,
  due_date timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint tasks_owner_tenant_fk foreign key (owner_id, tenant_id) references users(id, tenant_id) on delete set null (owner_id)
);

create index if not exists tasks_owner_status_due_idx on tasks(owner_id, status, due_date);
create index if not exists tasks_tenant_status_idx on tasks(tenant_id, status);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null,
  contact_id uuid,
  user_id uuid,
  activity_type activity_type not null,
  outcome text,
  response_time_seconds integer,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint activities_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint activities_contact_tenant_fk foreign key (contact_id, tenant_id) references contacts(id, tenant_id) on delete set null (contact_id),
  constraint activities_user_tenant_fk foreign key (user_id, tenant_id) references users(id, tenant_id) on delete set null (user_id)
);

create index if not exists activities_lead_occurred_idx on activities(lead_id, occurred_at desc);
create index if not exists activities_tenant_occurred_idx on activities(tenant_id, occurred_at desc);

create table if not exists tracking_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid,
  platform text not null,
  event_name text not null,
  status delivery_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  sent_at timestamptz,
  next_retry_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracking_events_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete set null (lead_id)
);

create index if not exists tracking_events_status_retry_idx on tracking_events(status, next_retry_at);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_rules_tenant_name_unique unique (tenant_id, name),
  constraint automation_rules_id_tenant_unique unique (id, tenant_id)
);

create index if not exists automation_rules_tenant_active_idx on automation_rules(tenant_id, active);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rule_id uuid not null,
  status text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint automation_runs_rule_tenant_fk foreign key (rule_id, tenant_id) references automation_rules(id, tenant_id) on delete cascade
);

create index if not exists automation_runs_rule_started_idx on automation_runs(rule_id, started_at desc);

create table if not exists webhooks (
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
  updated_at timestamptz not null default now(),
  constraint webhooks_tenant_name_unique unique (tenant_id, name),
  constraint webhooks_id_tenant_unique unique (id, tenant_id)
);

create index if not exists webhooks_tenant_status_idx on webhooks(tenant_id, status);

create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  webhook_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status delivery_status not null default 'queued',
  http_status integer,
  response_body text,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webhook_deliveries_webhook_tenant_fk foreign key (webhook_id, tenant_id) references webhooks(id, tenant_id) on delete cascade
);

create index if not exists webhook_deliveries_webhook_created_idx on webhook_deliveries(webhook_id, created_at desc);
create index if not exists webhook_deliveries_status_retry_idx on webhook_deliveries(status, next_retry_at);

create table if not exists sync_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_system text not null,
  source_table text,
  source_id text not null,
  target_system text not null,
  target_object text,
  target_id text not null,
  last_synced_at timestamptz not null default now(),
  constraint sync_mappings_source_target_unique unique(tenant_id, source_system, source_id, target_system, target_id)
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null,
  consent_type text not null,
  granted boolean not null,
  source text,
  ip_address inet,
  user_agent text,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint consent_records_contact_tenant_fk foreign key (contact_id, tenant_id) references contacts(id, tenant_id) on delete cascade
);

create index if not exists consent_records_contact_occurred_idx on consent_records(contact_id, occurred_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_user_tenant_fk foreign key (actor_user_id, tenant_id) references users(id, tenant_id) on delete set null (actor_user_id)
);

create index if not exists audit_logs_tenant_created_idx on audit_logs(tenant_id, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);

create table if not exists integration_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  label text not null,
  encrypted_secret text not null,
  scopes text[] not null default '{}',
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_tokens_tenant_provider_label_unique unique (tenant_id, provider, label),
  constraint integration_tokens_created_by_tenant_fk foreign key (created_by, tenant_id) references users(id, tenant_id) on delete set null (created_by)
);

create index if not exists integration_tokens_tenant_provider_idx on integration_tokens(tenant_id, provider);

insert into schema_migrations (version, description)
values ('001_initial_schema', 'Initial CRM PostgreSQL schema')
on conflict (version) do nothing;
