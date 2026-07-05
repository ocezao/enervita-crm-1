-- Activate and harden the solar dimensioning module.

alter table irradiacao_cidades
  add column if not exists lat numeric(9,6),
  add column if not exists lon numeric(9,6),
  add column if not exists classe text,
  add column if not exists estado_nome text,
  add column if not exists fonte_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'irradiacao_cidades_tenant_cidade_uf_unique'
  ) then
    alter table irradiacao_cidades
      add constraint irradiacao_cidades_tenant_cidade_uf_unique unique (tenant_id, cidade, uf);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proposals_id_tenant_unique'
  ) then
    alter table proposals
      add constraint proposals_id_tenant_unique unique (id, tenant_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dimensionamentos_proposal_tenant_fk'
  ) then
    alter table dimensionamentos
      add constraint dimensionamentos_proposal_tenant_fk
      foreign key (proposal_id, tenant_id) references proposals(id, tenant_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'linhas_custo_proposta_proposal_tenant_fk'
  ) then
    alter table linhas_custo_proposta
      add constraint linhas_custo_proposta_proposal_tenant_fk
      foreign key (proposal_id, tenant_id) references proposals(id, tenant_id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produtos_proposta_proposal_tenant_fk'
  ) then
    alter table produtos_proposta
      add constraint produtos_proposta_proposal_tenant_fk
      foreign key (proposal_id, tenant_id) references proposals(id, tenant_id) on delete cascade;
  end if;
end $$;

create index if not exists irradiacao_cidades_search_idx
  on irradiacao_cidades(tenant_id, lower(cidade), uf)
  where ativo = true;

insert into schema_migrations (version, description)
values ('018_solar_dimensioning_activation', 'Activate solar dimensioning reference data and proposal links')
on conflict (version) do nothing;
