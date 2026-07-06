-- Rollback: Redesenho do Pipeline Solar
-- Use este script apenas se precisar reverter a migration 022_solar_pipeline_update.sql

-- 1. Remover view de métricas
DROP VIEW IF EXISTS solar_funnel_metrics;

-- 2. Remover tabela de logs CAPI (cuidado: isso apaga o histórico de disparos)
DROP TABLE IF EXISTS meta_capi_logs;

-- 3. Reverter coluna pipeline_type (se necessário, comente se quiser manter)
-- Nota: Não removemos a coluna automaticamente para não perder dados
-- Execute manualmente se tiver certeza que não precisa mais:
-- ALTER TABLE leads DROP COLUMN IF EXISTS pipeline_type;

-- 4. Reverter etapas dos leads solares para genéricas
UPDATE leads
SET stage = CASE
    WHEN stage = 'solar_won' THEN 'won'::lead_stage
    WHEN stage = 'solar_lost' THEN 'lost'::lead_stage
    WHEN stage IN ('solar_qualification', 'solar_presentation') THEN 'proposal'::lead_stage
    WHEN stage = 'solar_negotiation' THEN 'negotiation'::lead_stage
    WHEN stage = 'solar_closing' THEN 'proposal'::lead_stage
    WHEN stage IN ('solar_new', 'solar_contact', 'solar_survey', 'solar_contract_sign') THEN stage
    ELSE stage
END,
pipeline_type = 'general',
updated_at = CURRENT_TIMESTAMP
WHERE pipeline_type = 'solar';

-- 5. Remover valores do enum (requer recriação do enum em alguns casos do PostgreSQL)
-- Nota: PostgreSQL não permite remover valores de enum facilmente.
-- Se necessário, crie um novo enum sem os valores indesejados e faça migrate dos dados.
-- Este passo é deixado em branco intencionalmente para segurança.

-- Rollback concluído
-- Verifique manualmente se há dependências restantes antes de deletar colunas ou enums.
