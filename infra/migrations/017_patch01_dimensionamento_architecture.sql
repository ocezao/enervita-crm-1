-- PATCH 01: Architectural corrections for solar dimensioning module.
-- Implements: separate entities, audit trail, snapshot immutability,
-- cost engine ordering, and dimensionamento as proposal step.

-- 1. Product entity (independent of dimensionamento)
CREATE TABLE IF NOT EXISTS produtos_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL,
  dimensionamento_id uuid REFERENCES dimensionamentos(id) ON DELETE SET NULL,
  
  -- Final product data (vendor can change these)
  quantidade_final integer NOT NULL,
  modelo_placa_id uuid REFERENCES modelos_placas(id) ON DELETE SET NULL,
  modelo_placa_nome text NOT NULL,
  modelo_placa_potencia_wp integer NOT NULL,
  modelo_inversor_id uuid REFERENCES modelos_inversores(id) ON DELETE SET NULL,
  modelo_inversor_nome text,
  potencia_total_kwp numeric(8,3) NOT NULL,
  tipo_telhado text,
  
  -- Snapshot of dimensionamento at time of creation
  snapshot_dimensionamento jsonb,
  
  -- Vendor overrides
  alterado_manualmente boolean NOT NULL DEFAULT false,
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT produtos_proposta_id_tenant_unique UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS produtos_proposta_tenant_idx ON produtos_proposta(tenant_id);
CREATE INDEX IF NOT EXISTS produtos_proposta_proposal_idx ON produtos_proposta(tenant_id, proposal_id);

-- 2. Audit trail for dimensionamento and product changes
CREATE TABLE IF NOT EXISTS auditoria_dimensionamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- What changed
  entidade_tipo text NOT NULL CHECK (entidade_tipo IN ('dimensionamento', 'produto_proposta')),
  entidade_id uuid NOT NULL,
  campo_alterado text NOT NULL,
  valor_anterior text,
  valor_novo text,
  
  -- Who and when
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_dimensionamento_tenant_idx ON auditoria_dimensionamento(tenant_id);
CREATE INDEX IF NOT EXISTS auditoria_dimensionamento_entidade_idx ON auditoria_dimensionamento(tenant_id, entidade_tipo, entidade_id);

-- 3. Add snapshot fields to dimensionamentos table
ALTER TABLE dimensionamentos 
ADD COLUMN IF NOT EXISTS formula_version text DEFAULT 'v1.0',
ADD COLUMN IF NOT EXISTS snapshot_imutavel boolean DEFAULT true;

-- 4. Create index for city lookup (Correction 08)
CREATE INDEX IF NOT EXISTS irradiacao_cidades_lookup_idx 
ON irradiacao_cidades(tenant_id, cidade, uf, ativo) 
WHERE ativo = true;

-- 5. Add cost engine ordering to custos_padrao
ALTER TABLE custos_padrao 
ADD COLUMN IF NOT EXISTS ordem_execucao integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS descricao text;

-- Update existing costs with proper ordering (Correction 06)
UPDATE custos_padrao SET ordem_execucao = 1 WHERE tipo = 'fixo';
UPDATE custos_padrao SET ordem_execucao = 2 WHERE tipo = 'por_modulo';
UPDATE custos_padrao SET ordem_execucao = 3 WHERE tipo = 'por_distancia';
UPDATE custos_padrao SET ordem_execucao = 10 WHERE tipo = 'percentual_sobre_total' AND nome LIKE '%Imposto%';
UPDATE custos_padrao SET ordem_execucao = 11 WHERE tipo = 'comissao_sobre_total';
UPDATE custos_padrao SET ordem_execucao = 12 WHERE tipo = 'percentual_sobre_total' AND nome LIKE '%Margem%';
