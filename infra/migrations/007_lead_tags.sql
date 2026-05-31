create table if not exists lead_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  slug text not null,
  color text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_tags_tenant_slug_unique unique (tenant_id, slug),
  constraint lead_tags_id_tenant_unique unique (id, tenant_id),
  constraint lead_tags_tenant_fk foreign key (tenant_id) references tenants(id) on delete cascade,
  constraint lead_tags_created_by_tenant_fk foreign key (created_by, tenant_id) references users(id, tenant_id) on delete set null
);

create table if not exists lead_tag_assignments (
  tenant_id uuid not null,
  lead_id uuid not null,
  tag_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  primary key (tenant_id, lead_id, tag_id),
  constraint lead_tag_assignments_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint lead_tag_assignments_tag_tenant_fk foreign key (tag_id, tenant_id) references lead_tags(id, tenant_id) on delete cascade,
  constraint lead_tag_assignments_assigned_by_tenant_fk foreign key (assigned_by, tenant_id) references users(id, tenant_id) on delete set null
);

create index if not exists lead_tag_assignments_tag_idx on lead_tag_assignments (tenant_id, tag_id, lead_id);
create index if not exists lead_tag_assignments_lead_idx on lead_tag_assignments (tenant_id, lead_id);
