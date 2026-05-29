-- Native proposals module for the custom Enervita CRM.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type proposal_status as enum ('draft', 'sent', 'accepted', 'lost', 'expired');
  end if;
end $$;

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null,
  title text not null,
  status proposal_status not null default 'draft',
  monthly_bill_value numeric(14,2),
  estimated_kwh numeric(14,2),
  discount_percentage numeric(5,2),
  projected_monthly_savings numeric(14,2),
  projected_annual_savings numeric(14,2),
  valid_until timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposals_lead_tenant_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete cascade,
  constraint proposals_created_by_tenant_fk foreign key (created_by, tenant_id) references users(id, tenant_id) on delete set null (created_by)
);

create index if not exists proposals_tenant_status_idx on proposals(tenant_id, status);
create index if not exists proposals_lead_created_idx on proposals(lead_id, created_at desc);

insert into permissions (key, resource, action, description)
values
  ('page.proposals', 'page', 'proposals', 'Acessar módulo de propostas'),
  ('proposal.view', 'proposal', 'view', 'Visualizar propostas'),
  ('proposal.create', 'proposal', 'create', 'Criar propostas'),
  ('proposal.edit', 'proposal', 'edit', 'Editar propostas'),
  ('proposal.send', 'proposal', 'send', 'Enviar propostas'),
  ('proposal.accept', 'proposal', 'accept', 'Aceitar propostas')
on conflict (key) do nothing;

insert into schema_migrations (version, description)
values ('003_proposals', 'Native proposals module')
on conflict (version) do nothing;
