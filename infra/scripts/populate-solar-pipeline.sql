-- Script: Populate Solar Pipeline Stages
-- Description: Inserts the 10 stages of the Solar Pipeline into the database if they don't exist.
-- Usage: psql $DATABASE_URL -f infra/scripts/populate-solar-pipeline.sql

BEGIN;

-- Create pipeline type if not exists (adjust name based on your schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage') THEN
        CREATE TYPE pipeline_stage AS ENUM (
            'new', 
            'contact', 
            'qualification', 
            'presentation', 
            'negotiation', 
            'closing', 
            'survey', 
            'contract_sign', 
            'won', 
            'lost'
        );
    END IF;
END
$$;

-- Insert Solar Pipeline Configuration
-- Adjust table names based on your actual schema (e.g., pipelines, pipeline_stages)
INSERT INTO pipelines (name, type, is_active, created_at, updated_at)
VALUES ('Sistema Solar', 'solar', true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET 
    type = 'solar',
    is_active = true,
    updated_at = NOW();

-- Get the pipeline ID
DO $$
DECLARE
    v_pipeline_id INTEGER;
BEGIN
    SELECT id INTO v_pipeline_id FROM pipelines WHERE name = 'Sistema Solar';

    -- Stage 1: Novo Lead
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Novo Lead', 'new', 1, NULL, NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 2: Atendimento Iniciado
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Atendimento Iniciado', 'contact', 2, 'Contact', NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 3: Elaboração de Proposta (Qualificação) - CAPI Trigger #1
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Elaboração de Proposta', 'qualification', 3, 'Lead', NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 4: Apresentação de Proposta
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Apresentação de Proposta', 'presentation', 4, 'ViewContent', NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 5: Negociação / Follow-up
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Negociação / Follow-up', 'negotiation', 5, NULL, NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 6: Fechamento - CAPI Trigger #2
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Fechamento', 'closing', 6, 'InitiateCheckout', NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 7: Vistoria / Estudo Técnico
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Vistoria / Estudo Técnico', 'survey', 7, NULL, NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 8: Assinatura de Contrato - CAPI Trigger #3
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Assinatura de Contrato', 'contract_sign', 8, 'Purchase', NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 9: Ganho / Contrato Assinado
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Ganho / Contrato Assinado', 'won', 9, NULL, NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

    -- Stage 10: Pedido Perdido
    INSERT INTO pipeline_stages (pipeline_id, name, stage_key, order_index, capi_event, created_at)
    VALUES (v_pipeline_id, 'Pedido Perdido', 'lost', 10, NULL, NOW())
    ON CONFLICT (pipeline_id, stage_key) DO NOTHING;

END $$;

COMMIT;

-- Verification Query
SELECT 
    p.name as pipeline_name,
    ps.stage_key,
    ps.name as stage_name,
    ps.order_index,
    ps.capi_event
FROM pipelines p
JOIN pipeline_stages ps ON p.id = ps.pipeline_id
WHERE p.name = 'Sistema Solar'
ORDER BY ps.order_index;
