-- Nova pipeline Usina Solar com 6 etapas e eventos Meta CAPI

insert into lead_pipelines (tenant_id, key, label, description, sort_order)
select t.id, 'usina_solar_nova', 'Usina Solar', 'Funil comercial para investimento em usina solar (6 etapas).', 40
from tenants t
on conflict (tenant_id, key) do update
  set label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

insert into lead_pipeline_stages (tenant_id, pipeline_key, key, label, legacy_stage, sort_order, is_terminal)
select t.id, 'usina_solar_nova', stage.key, stage.label, stage.legacy_stage::lead_stage, stage.sort_order, stage.is_terminal
from tenants t
cross join (
  values
    ('novo_lead', 'Novo Lead', 'novo_lead', 10, false),
    ('atendimento_iniciado', 'Atendimento iniciado', 'atendimento_iniciado', 20, false),
    ('reuniao', 'Reunião', 'diagnostico', 30, false),
    ('aguardando_assinatura', 'Aguardando Assinatura do contrato', 'contrato_enervita', 40, false),
    ('ganho_contrato_assinado', 'Ganho/Contrato assinado', 'contrato_enervita', 50, true),
    ('perdido', 'Perdido', 'perdido', 60, true)
) as stage(key, label, legacy_stage, sort_order, is_terminal)
on conflict (tenant_id, pipeline_key, key) do update
  set label = excluded.label,
      legacy_stage = excluded.legacy_stage,
      sort_order = excluded.sort_order,
      is_terminal = excluded.is_terminal,
      updated_at = now();
