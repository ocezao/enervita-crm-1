create table if not exists lead_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  lead_id uuid not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  file_data bytea,
  file_url text,
  storage_backend text not null default 'postgres',
  checksum_sha256 text,
  is_public boolean not null default false,
  uploaded_by_user_id uuid,
  uploaded_by_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_documents_storage_backend_check check (storage_backend in ('postgres', 'legacy_url', 'external_url')),
  constraint lead_documents_content_check check (
    (storage_backend = 'postgres' and file_data is not null)
    or (storage_backend <> 'postgres' and file_url is not null)
  ),
  constraint lead_documents_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint lead_documents_uploaded_by_tenant_fk foreign key (uploaded_by_user_id, tenant_id) references users(id, tenant_id) on delete set null (uploaded_by_user_id)
);

alter table lead_documents add column if not exists file_data bytea;
alter table lead_documents add column if not exists storage_backend text not null default 'postgres';
alter table lead_documents add column if not exists checksum_sha256 text;
alter table lead_documents add column if not exists uploaded_by_user_id uuid;
alter table lead_documents alter column file_url drop not null;

create index if not exists lead_documents_tenant_lead_created_idx on lead_documents (tenant_id, lead_id, created_at desc);
create index if not exists lead_documents_checksum_idx on lead_documents (tenant_id, checksum_sha256);

insert into schema_migrations (version, description)
values ('015_lead_documents', 'Store authenticated lead documents in Postgres')
on conflict (version) do nothing;
