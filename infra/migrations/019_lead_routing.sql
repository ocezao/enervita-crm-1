create table if not exists lead_routing_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  random_enabled boolean not null default true,
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

create table if not exists lead_routing_services (
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  label text not null,
  keywords jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table if not exists lead_routing_user_rules (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  rule_key text not null default 'none',
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint lead_routing_user_rules_user_fk foreign key (tenant_id, user_id) references users(tenant_id, id) on delete cascade
);

create table if not exists lead_routing_state (
  tenant_id uuid not null references tenants(id) on delete cascade,
  bucket_key text not null,
  last_user_id uuid null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, bucket_key)
);

create index if not exists lead_routing_user_rules_tenant_rule_idx
  on lead_routing_user_rules (tenant_id, rule_key);

insert into lead_routing_settings (tenant_id, random_enabled)
select id, true from tenants
on conflict (tenant_id) do nothing;

insert into lead_routing_services (tenant_id, key, label, keywords, sort_order)
select t.id, service.key, service.label, service.keywords::jsonb, service.sort_order
from tenants t
cross join (
  values
    ('assinatura', 'Assinatura', '["assinatura", "solar por assinatura", "energia por assinatura"]', 10),
    ('solar_proprio', 'Sistema proprio / painel solar', '["painel", "placa", "sistema proprio", "energia solar", "solar proprio", "fotovoltaico"]', 20),
    ('usina', 'Usina solar', '["usina", "investimento em usina", "fazenda solar"]', 30),
    ('bateria_backup', 'Bateria e backup', '["bateria", "backup", "armazenamento", "nobreak"]', 40),
    ('clube_enervita', 'Clube Enervita', '["clube enervita", "clube"]', 50),
    ('indicacao', 'Indicacao', '["indicacao", "indicação", "indique", "referencia", "referral"]', 60)
) as service(key, label, keywords, sort_order)
on conflict (tenant_id, key) do update
  set label = excluded.label,
      keywords = excluded.keywords,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

insert into lead_routing_user_rules (tenant_id, user_id, rule_key, updated_at)
select u.tenant_id,
       u.id,
       case
         when lower(u.email) in ('consorciodeenergia@enervita.com.br', 'anne@enervita.com.br')
           or lower(u.name) like '%anne%' then 'assinatura'
         else 'random'
       end,
       now()
from users u
where u.status = 'active'
  and (
    exists (
      select 1
        from user_roles ur
        join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
       where ur.tenant_id = u.tenant_id
         and ur.user_id = u.id
         and r.name in ('sdr', 'vendedor', 'seller', 'closer')
    )
    or lower(u.email) in ('consorciodeenergia@enervita.com.br', 'anne@enervita.com.br')
    or lower(u.name) like '%anne%'
  )
  and not exists (
    select 1
      from user_roles admin_ur
      join roles admin_r on admin_r.tenant_id = admin_ur.tenant_id and admin_r.id = admin_ur.role_id
     where admin_ur.tenant_id = u.tenant_id
       and admin_ur.user_id = u.id
       and admin_r.name = 'admin'
  )
on conflict (tenant_id, user_id) do nothing;
