-- Migration: Redesenho do Pipeline Solar e Adição de Logs CAPI
-- Descrição: Atualiza as etapas do pipeline solar para o novo funil de 10 estágios
--            e cria tabela de auditoria para disparos da Meta Conversions API.

-- 1. Criar tabela de logs de integração CAPI (se não existir)
CREATE TABLE IF NOT EXISTS meta_capi_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    stage_key VARCHAR(50) NOT NULL,
    event_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'pending')),
    payload_sent JSONB NOT NULL,
    meta_response JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para consultas rápidas por lead e status
CREATE INDEX IF NOT EXISTS idx_meta_capi_logs_lead_id ON meta_capi_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_logs_status ON meta_capi_logs(status);
CREATE INDEX IF NOT EXISTS idx_meta_capi_logs_created_at ON meta_capi_logs(created_at);

-- 2. Adicionar coluna de pipeline específico ao leads (se não existir)
-- Isso permite diferenciar leads do pipeline Solar de outros pipelines
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'pipeline_type') THEN
        ALTER TABLE leads ADD COLUMN pipeline_type VARCHAR(50) DEFAULT 'general';
        CREATE INDEX idx_leads_pipeline_type ON leads(pipeline_type);
    END IF;
END $$;

-- 3. Atualizar ou inserir novas etapas do pipeline solar
-- Nota: Ajuste os IDs das etapas conforme a estrutura existente no seu banco
-- Este script assume uma tabela 'pipeline_stages' ou similar

-- Se você usa enum no banco, adicione os novos valores:
DO $$
BEGIN
    -- Tentativa de adicionar valores ao enum se ele existir
    -- Ajuste 'lead_stage' para o nome real do seu enum
    BEGIN
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_new';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_contact';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_qualification';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_presentation';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_negotiation';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_closing';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_survey';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_contract_sign';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_won';
        ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'solar_lost';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Enum não encontrado ou valores já existem. Ignorando alteração de enum.';
    END;
END $$;

-- 4. Script de migração de dados para leads existentes
-- Move leads que estão em etapas genéricas para as novas etapas solares equivalentes
-- Ajuste conforme a lógica de mapeamento do seu negócio

UPDATE leads 
SET pipeline_type = 'solar',
    stage = CASE 
        WHEN stage IN ('won', 'closed') THEN 'solar_won'::lead_stage
        WHEN stage IN ('lost', 'rejected') THEN 'solar_lost'::lead_stage
        WHEN stage IN ('proposal', 'quotation') THEN 'solar_qualification'::lead_stage
        WHEN stage IN ('negotiation') THEN 'solar_negotiation'::lead_stage
        ELSE stage -- Mantém o estágio atual se não houver correspondência direta
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE pipeline_type IS NULL OR pipeline_type = 'general'
  AND EXISTS (
    SELECT 1 FROM lead_tags lt 
    JOIN tags t ON lt.tag_id = t.id 
    WHERE lt.lead_id = leads.id AND t.name ILIKE '%solar%'
  );

-- 5. Adicionar comentários nas colunas para documentação
COMMENT ON TABLE meta_capi_logs IS 'Logs de auditoria para disparos da Meta Conversions API (CAPI)';
COMMENT ON COLUMN meta_capi_logs.event_name IS 'Nome do evento Meta: Lead, Purchase, InitiateCheckout, etc.';
COMMENT ON COLUMN meta_capi_logs.status IS 'Status do disparo: success, error, pending';
COMMENT ON COLUMN leads.pipeline_type IS 'Tipo de pipeline: general, solar, etc. Para segmentação de funis';

-- 6. Criar view para monitoramento de conversões solares
CREATE OR REPLACE VIEW solar_funnel_metrics AS
SELECT 
    l.stage,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN mcl.status = 'success' THEN 1 END) as capi_success_count,
    COUNT(CASE WHEN mcl.status = 'error' THEN 1 END) as capi_error_count
FROM leads l
LEFT JOIN meta_capi_logs mcl ON l.id = mcl.lead_id
WHERE l.pipeline_type = 'solar' OR (l.tags && ARRAY(SELECT id FROM tags WHERE name ILIKE '%solar%'))
GROUP BY l.stage
ORDER BY 
    CASE l.stage
        WHEN 'solar_new' THEN 1
        WHEN 'solar_contact' THEN 2
        WHEN 'solar_qualification' THEN 3
        WHEN 'solar_presentation' THEN 4
        WHEN 'solar_negotiation' THEN 5
        WHEN 'solar_closing' THEN 6
        WHEN 'solar_survey' THEN 7
        WHEN 'solar_contract_sign' THEN 8
        WHEN 'solar_won' THEN 9
        WHEN 'solar_lost' THEN 10
        ELSE 99
    END;

-- Fim da migration
-- Para rollback, execute o arquivo: infra/migrations/022_solar_pipeline_rollback.sql
