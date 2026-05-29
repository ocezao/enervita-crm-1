-- Incremental schema for per-user/per-employee pipeline stage permissions.
-- Do not edit 001_initial_schema.sql after it has been applied.

do $$
begin
  if not exists (
    select 1
      from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'employee_profiles'
       and constraint_name = 'employee_profiles_id_tenant_unique'
  ) then
    alter table employee_profiles
      add constraint employee_profiles_id_tenant_unique unique (id, tenant_id);
  end if;
end $$;

create table if not exists user_stage_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid,
  employee_profile_id uuid,
  permission_id uuid not null references permissions(id) on delete cascade,
  stage lead_stage not null,
  effect permission_effect not null default 'allow',
  granted_by uuid,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_stage_permissions_scope_check check (
    (user_id is not null and employee_profile_id is null)
    or (user_id is null and employee_profile_id is not null)
  ),
  constraint user_stage_permissions_user_tenant_fk foreign key (user_id, tenant_id) references users(id, tenant_id) on delete cascade,
  constraint user_stage_permissions_employee_profile_tenant_fk foreign key (employee_profile_id, tenant_id) references employee_profiles(id, tenant_id) on delete cascade,
  constraint user_stage_permissions_granted_by_tenant_fk foreign key (granted_by, tenant_id) references users(id, tenant_id) on delete set null (granted_by)
);

create unique index if not exists user_stage_permissions_user_unique_idx
  on user_stage_permissions (tenant_id, user_id, permission_id, stage)
  where user_id is not null;

create unique index if not exists user_stage_permissions_employee_profile_unique_idx
  on user_stage_permissions (tenant_id, employee_profile_id, permission_id, stage)
  where employee_profile_id is not null;

create index if not exists user_stage_permissions_tenant_stage_idx
  on user_stage_permissions (tenant_id, stage);

insert into schema_migrations (version, description)
values ('002_user_stage_permissions', 'Add per-user and per-employee pipeline stage permissions')
on conflict (version) do nothing;
