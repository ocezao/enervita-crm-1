alter table ad_platform_accounts add column if not exists metadata jsonb not null default '{}'::jsonb;
