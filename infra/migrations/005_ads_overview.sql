-- Paid media overview foundation for Meta and Google Ads.

create table if not exists ad_platform_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google_ads')),
  account_name text not null,
  external_account_id text,
  status text not null default 'pending_credentials' check (status in ('pending_credentials', 'connected', 'error', 'disabled')),
  credential_hint text,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_platform_accounts_unique unique (tenant_id, platform, account_name),
  constraint ad_platform_accounts_id_tenant_unique unique (id, tenant_id)
);

create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_campaign_id text,
  name text not null,
  objective text,
  effective_status text not null default 'unknown',
  budget_amount numeric(14,2),
  spend_amount numeric(14,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_account_fk foreign key (account_id, tenant_id) references ad_platform_accounts(id, tenant_id) on delete cascade,
  constraint ad_campaigns_unique unique (tenant_id, platform, external_campaign_id),
  constraint ad_campaigns_id_tenant_unique unique (id, tenant_id)
);

create table if not exists ad_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_ad_set_id text,
  name text not null,
  effective_status text not null default 'unknown',
  budget_amount numeric(14,2),
  spend_amount numeric(14,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_sets_campaign_fk foreign key (campaign_id, tenant_id) references ad_campaigns(id, tenant_id) on delete cascade,
  constraint ad_sets_unique unique (tenant_id, platform, external_ad_set_id),
  constraint ad_sets_id_tenant_unique unique (id, tenant_id)
);

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ad_set_id uuid not null,
  platform text not null check (platform in ('meta', 'google_ads')),
  external_ad_id text,
  name text not null,
  effective_status text not null default 'unknown',
  creative_name text,
  spend_amount numeric(14,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_ad_set_fk foreign key (ad_set_id, tenant_id) references ad_sets(id, tenant_id) on delete cascade,
  constraint ads_unique unique (tenant_id, platform, external_ad_id)
);

create index if not exists ad_campaigns_tenant_platform_status_idx on ad_campaigns(tenant_id, platform, effective_status);
create index if not exists ad_sets_campaign_status_idx on ad_sets(campaign_id, effective_status);
create index if not exists ads_ad_set_status_idx on ads(ad_set_id, effective_status);

insert into ad_platform_accounts (tenant_id, platform, account_name, status, credential_hint)
select t.id, 'meta', 'Meta Ads - Enervita', 'pending_credentials', 'Aguardando system user token, ad account id e pixel/dataset id' from tenants t
on conflict (tenant_id, platform, account_name) do update set status = excluded.status, credential_hint = excluded.credential_hint, updated_at = now();

insert into ad_platform_accounts (tenant_id, platform, account_name, status, credential_hint)
select t.id, 'google_ads', 'Google Ads - Enervita', 'pending_credentials', 'Aguardando customer id, developer token e OAuth/refresh token' from tenants t
on conflict (tenant_id, platform, account_name) do update set status = excluded.status, credential_hint = excluded.credential_hint, updated_at = now();

insert into permissions (key, resource, action, description) values
  ('page.ads', 'page', 'ads', 'Permite abrir a aba de campanhas, conjuntos e anúncios'),
  ('ads.view', 'ads', 'view', 'Permite visualizar snapshots Meta/Google Ads'),
  ('ads.manage', 'ads', 'manage', 'Permite administrar conexão de Meta/Google Ads')
on conflict (key) do update set resource = excluded.resource, action = excluded.action, description = excluded.description;

insert into schema_migrations (version, description) values ('005_ads_overview', 'Paid media campaign hierarchy and pending credential overview') on conflict (version) do nothing;
