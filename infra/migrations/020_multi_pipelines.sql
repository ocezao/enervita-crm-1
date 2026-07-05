create table if not exists lead_pipelines (
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table if not exists lead_pipeline_stages (
  tenant_id uuid not null references tenants(id) on delete cascade,
  pipeline_key text not null,
  key text not null,
  label text not null,
  legacy_stage lead_stage not null,
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, pipeline_key, key),
  constraint lead_pipeline_stages_pipeline_fk foreign key (tenant_id, pipeline_key) references lead_pipelines(tenant_id, key) on delete cascade
);

create table if not exists lead_pipeline_user_access (
  tenant_id uuid not null references tenants(id) on delete cascade,
  pipeline_key text not null,
  user_id uuid not null,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, pipeline_key, user_id),
  constraint lead_pipeline_user_access_pipeline_fk foreign key (tenant_id, pipeline_key) references lead_pipelines(tenant_id, key) on delete cascade,
  constraint lead_pipeline_user_access_user_fk foreign key (tenant_id, user_id) references users(tenant_id, id) on delete cascade
);

alter table leads add column if not exists pipeline_key text not null default 'geral';
alter table leads add column if not exists pipeline_stage_key text not null default 'novo_lead';
alter table lead_routing_services add column if not exists pipeline_key text not null default 'geral';

create index if not exists leads_tenant_pipeline_stage_idx on leads(tenant_id, pipeline_key, pipeline_stage_key);
create index if not exists lead_pipeline_user_access_user_idx on lead_pipeline_user_access(tenant_id, user_id);

insert into lead_pipelines (tenant_id, key, label, description, sort_order)
select t.id, pipeline.key, pipeline.label, pipeline.description, pipeline.sort_order
from tenants t
cross join (
  values
    ('geral', 'Pipeline Geral', 'Fallback para leads sem classificacao clara.', 10),
    ('usina_solar', 'Usina Solar', 'Funil comercial para investimento em usina solar.', 20),
    ('energia_assinatura', 'Energia por Assinatura', 'Funil comercial para energia solar por assinatura.', 30)
) as pipeline(key, label, description, sort_order)
on conflict (tenant_id, key) do update
  set label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

insert into lead_pipeline_stages (tenant_id, pipeline_key, key, label, legacy_stage, sort_order, is_terminal)
select t.id, stage.pipeline_key, stage.key, stage.label, stage.legacy_stage::lead_stage, stage.sort_order, stage.is_terminal
from tenants t
cross join (
  values
    ('geral', 'novo_lead', 'Novo lead', 'novo_lead', 10, false),
    ('geral', 'qualificacao', 'Qualificacao', 'qualificacao', 20, false),
    ('geral', 'atendimento_iniciado', 'Atendimento iniciado', 'atendimento_iniciado', 30, false),
    ('geral', 'conta_recebida', 'Conta recebida', 'conta_recebida', 40, false),
    ('geral', 'diagnostico', 'Diagnostico', 'diagnostico', 50, false),
    ('geral', 'proposta_enviada', 'Proposta enviada', 'proposta_enviada', 60, false),
    ('geral', 'contrato_enervita', 'Contrato Enervita', 'contrato_enervita', 70, true),
    ('geral', 'perdido', 'Perdido', 'perdido', 80, true),

    ('usina_solar', 'novo_lead', 'Novo Lead', 'novo_lead', 10, false),
    ('usina_solar', 'qualificacao', 'Qualificacao', 'qualificacao', 20, false),
    ('usina_solar', 'elaboracao_proposta', 'Elaboracao de proposta', 'diagnostico', 30, false),
    ('usina_solar', 'apresentacao_proposta', 'Apresentacao de proposta', 'proposta_enviada', 40, false),
    ('usina_solar', 'negociacao_follow_up', 'Negociacao / Follow-up', 'proposta_enviada', 50, false),
    ('usina_solar', 'fechamento', 'Fechamento', 'proposta_enviada', 60, false),
    ('usina_solar', 'vistoria_estudo_tecnico', 'Vistoria / Estudo tecnico', 'diagnostico', 70, false),
    ('usina_solar', 'assinatura_contrato', 'Assinatura de Contrato', 'contrato_enervita', 80, false),
    ('usina_solar', 'ganho_contrato_assinado', 'Ganho / Contrato assinado', 'contrato_enervita', 90, true),
    ('usina_solar', 'perdido_desqualificado', 'Perdido / Desqualificado', 'perdido', 100, true),

    ('energia_assinatura', 'novo_lead', 'Novo Lead', 'novo_lead', 10, false),
    ('energia_assinatura', 'qualificacao', 'Qualificacao', 'qualificacao', 20, false),
    ('energia_assinatura', 'elaboracao_proposta', 'Elaboracao de proposta', 'diagnostico', 30, false),
    ('energia_assinatura', 'apresentacao_proposta', 'Apresentacao de proposta', 'proposta_enviada', 40, false),
    ('energia_assinatura', 'analise_documentos', 'Analise de documentos', 'conta_recebida', 50, false),
    ('energia_assinatura', 'elaboracao_contrato_adesao', 'Elaboracao de contrato e adesao', 'contrato_enervita', 60, false),
    ('energia_assinatura', 'aguardando_assinatura_contrato', 'Aguardando Assinatura do contrato', 'contrato_enervita', 70, false),
    ('energia_assinatura', 'ganho_contrato_assinado', 'Ganho / Contrato assinado', 'contrato_enervita', 80, true),
    ('energia_assinatura', 'perdido_desqualificado', 'Perdido / Desqualificado', 'perdido', 90, true)
) as stage(pipeline_key, key, label, legacy_stage, sort_order, is_terminal)
on conflict (tenant_id, pipeline_key, key) do update
  set label = excluded.label,
      legacy_stage = excluded.legacy_stage,
      sort_order = excluded.sort_order,
      is_terminal = excluded.is_terminal,
      updated_at = now();

update lead_routing_services
   set pipeline_key = case
     when key = 'assinatura' then 'energia_assinatura'
     when key = 'usina' then 'usina_solar'
     else 'geral'
   end;

insert into lead_pipeline_user_access (tenant_id, pipeline_key, user_id, updated_at)
select u.tenant_id, access.pipeline_key, u.id, now()
from users u
join (
  values
    ('energia_assinatura', 'consorciodeenergia@enervita.com.br', '%anne%'),
    ('energia_assinatura', 'anne@enervita.com.br', '%anne%'),
    ('usina_solar', 'cleytonvendas@enervita.com.br', '%cleyton%'),
    ('usina_solar', 'pedrovidal@enervita.com.br', '%pedro%'),
    ('usina_solar', 'vendas@enervita.com.br', '%pedro%'),
    ('geral', 'cleytonvendas@enervita.com.br', '%cleyton%'),
    ('geral', 'pedrovidal@enervita.com.br', '%pedro%'),
    ('geral', 'vendas@enervita.com.br', '%pedro%')
) as access(pipeline_key, email, name_pattern)
  on lower(u.email) = access.email or lower(u.name) like access.name_pattern
where u.status = 'active'
  and not exists (
    select 1
      from user_roles ur
      join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
     where ur.tenant_id = u.tenant_id and ur.user_id = u.id and r.name = 'admin'
  )
on conflict (tenant_id, pipeline_key, user_id) do nothing;

update leads
   set pipeline_key = case
         when coalesce(metadata #>> '{routing,serviceKey}', '') = 'assinatura'
           or lower(coalesce(metadata::text, '')) like '%assinatura%' then 'energia_assinatura'
         when coalesce(metadata #>> '{routing,serviceKey}', '') = 'usina'
           or lower(coalesce(metadata::text, '')) like '%usina%' then 'usina_solar'
         else coalesce(nullif(pipeline_key, ''), 'geral')
       end,
       pipeline_stage_key = case
         when stage::text = 'contrato_enervita' then 'ganho_contrato_assinado'
         when stage::text = 'perdido' then 'perdido_desqualificado'
         else stage::text
       end;

