-- Solar dimensioning tables for Enervita CRM.
-- Implements: irradiation by city, panel models, inverter models,
-- roof types, dimensioning parameters, standard costs,
-- dimensioning snapshots, and proposal cost lines.

-- 1. Irradiation by city
create table if not exists irradiacao_cidades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cidade text not null,
  uf char(2) not null,
  codigo_ibge text,
  irradiacao_kwh_m2_dia numeric(6,3) not null,
  fonte text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint irradiacao_cidades_id_tenant_unique unique (id, tenant_id)
);
create index if not exists irradiacao_cidades_tenant_idx on irradiacao_cidades(tenant_id);
create index if not exists irradiacao_cidades_cidade_uf_idx on irradiacao_cidades(tenant_id, cidade, uf);

-- 2. Panel models
create table if not exists modelos_placas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  fabricante text,
  potencia_wp integer not null,
  area_util_m2 numeric(6,3) not null,
  eficiencia_decimal numeric(5,4) not null,
  ativo boolean not null default true,
  padrao boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modelos_placas_id_tenant_unique unique (id, tenant_id)
);
create index if not exists modelos_placas_tenant_idx on modelos_placas(tenant_id);

-- 3. Inverter models
create table if not exists modelos_inversores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  fabricante text,
  capacidade_kw numeric(8,3) not null,
  sobrecarga_decimal numeric(5,4) not null default 0.20,
  ativo boolean not null default true,
  padrao boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modelos_inversores_id_tenant_unique unique (id, tenant_id)
);
create index if not exists modelos_inversores_tenant_idx on modelos_inversores(tenant_id);

-- 4. Roof types
create table if not exists tipos_telhado (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  perda_padrao_decimal numeric(5,4) not null default 0.20,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tipos_telhado_id_tenant_unique unique (id, tenant_id)
);
create index if not exists tipos_telhado_tenant_idx on tipos_telhado(tenant_id);

-- 5. Default dimensioning parameters
create table if not exists parametros_dimensionamento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  chave text not null,
  valor_decimal numeric(8,4),
  valor_texto text,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parametros_dimensionamento_tenant_chave_unique unique (tenant_id, chave),
  constraint parametros_dimensionamento_id_tenant_unique unique (id, tenant_id)
);
create index if not exists parametros_dimensionamento_tenant_idx on parametros_dimensionamento(tenant_id);

-- 6. Standard costs
create table if not exists custos_padrao (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('fixo', 'por_modulo', 'por_distancia', 'percentual_sobre_total', 'comissao_sobre_total')),
  valor numeric(12,2),
  percentual numeric(6,4),
  base_calculo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custos_padrao_id_tenant_unique unique (id, tenant_id)
);
create index if not exists custos_padrao_tenant_idx on custos_padrao(tenant_id);

-- 7. Dimensioning snapshots (audit trail)
create table if not exists dimensionamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  proposal_id uuid,
  -- inputs
  cidade text not null,
  uf char(2) not null,
  consumo_medio_mensal_kwh numeric(10,2) not null,
  tipo_telhado text,
  perda_decimal numeric(5,4) not null,
  sobra_decimal numeric(5,4) not null,
  modelo_placa_id uuid,
  modelo_placa_nome text not null,
  modelo_placa_potencia_wp integer not null,
  modelo_placa_area_m2 numeric(6,3) not null,
  modelo_placa_eficiencia numeric(5,4) not null,
  modelo_inversor_id uuid,
  modelo_inversor_nome text,
  modelo_inversor_capacidade_kw numeric(8,3),
  modelo_inversor_sobrecarga numeric(5,4),
  margem_inversor_decimal numeric(5,4) not null default 0.10,
  dias_mes integer not null default 30,
  irradiacao_kwh_m2_dia numeric(6,3) not null,
  -- outputs
  producao_diaria_bruta_placa numeric(10,4),
  producao_diaria_real_placa numeric(10,4),
  producao_mensal_real_placa numeric(10,2),
  consumo_com_sobra_kwh numeric(10,2),
  quantidade_bruta_placas numeric(8,2),
  quantidade_sugerida integer,
  potencia_total_sugerida_kwp numeric(8,3),
  inversor_sugerido_id uuid,
  inversor_sugerido_nome text,
  inversor_capacidade_nominal_kw numeric(8,3),
  inversor_sobrecarga_decimal numeric(5,4),
  inversor_capacidade_real_kw numeric(8,3),
  inversor_sobra_percentual numeric(6,2),
  status text not null default 'sucesso' check (status in (
    'sucesso', 'pendente_irradiacao', 'placa_invalida', 'inversor_incompativel',
    'entradas_invalidas', 'calculo_incompleto'
  )),
  mensagens_erro jsonb not null default '[]'::jsonb,
  mensagens_alerta jsonb not null default '[]'::jsonb,
  usuario_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dimensionamentos_id_tenant_unique unique (id, tenant_id),
  constraint dimensionamentos_lead_fk foreign key (lead_id, tenant_id) references leads(id, tenant_id) on delete set null
);
create index if not exists dimensionamentos_tenant_idx on dimensionamentos(tenant_id);
create index if not exists dimensionamentos_lead_idx on dimensionamentos(tenant_id, lead_id);

-- 8. Proposal cost lines
create table if not exists linhas_custo_proposta (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proposal_id uuid not null,
  dimensionamento_id uuid references dimensionamentos(id) on delete set null,
  custo_padrao_id uuid references custos_padrao(id) on delete set null,
  nome text not null,
  tipo text not null check (tipo in ('fixo', 'por_modulo', 'por_distancia', 'percentual_sobre_total', 'comissao_sobre_total')),
  valor_calculado numeric(12,2) not null default 0,
  quantidade_modulos integer,
  distancia_km numeric(8,2),
  percentual numeric(6,4),
  origem text not null default 'automatico' check (origem in ('automatico', 'manual', 'ajustado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linhas_custo_proposta_id_tenant_unique unique (id, tenant_id)
);
create index if not exists linhas_custo_proposta_tenant_idx on linhas_custo_proposta(tenant_id);
create index if not exists linhas_custo_proposta_proposal_idx on linhas_custo_proposta(tenant_id, proposal_id);
