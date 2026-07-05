-- Migration: 021_performance_indexes.sql
-- Purpose: Adicionar índices estratégicos para melhorar performance das queries principais
-- Created: Performance Improvement Plan - Fase 1

-- ============================================================
-- ÍNDICES PARA TABELA LEADS
-- ============================================================

-- Índice composto para listagem de leads com filtros combinados
-- Otimiza: GET /api/leads?stage=X&owner=Y (caso mais comum)
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_stage_owner_updated_idx 
ON leads(tenant_id, stage, sdr_owner_id, updated_at DESC);

-- Índice para filtro por pipeline (multi-pipeline support)
-- Otimiza: Listagens filtradas por pipeline_key
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_pipeline_updated_idx 
ON leads(tenant_id, pipeline_key, updated_at DESC);

-- Índice para busca por proprietário + próxima ação (dashboard/tasks)
-- Otimiza: Dashboard de leads por vencer, tasks do vendedor
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_owner_next_action_idx 
ON leads(sdr_owner_id, next_action_at) 
WHERE next_action_at IS NOT NULL;

-- Índice para leads criados recentemente (relatórios)
-- Otimiza: Relatórios de leads criados por período
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_created_desc_idx 
ON leads(tenant_id, created_at DESC);

-- ============================================================
-- ÍNDICES PARA TABELA CONTACTS
-- ============================================================

-- Índice já existente para email (lower), mantendo consistência
-- CREATE INDEX IF NOT EXISTS contacts_tenant_email_idx ON contacts(tenant_id, lower(email));

-- Índice para busca por telefone
-- Otimiza: Busca de leads por telefone (duplicação, merge)
CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_tenant_phone_idx 
ON contacts(tenant_id, phone) 
WHERE phone IS NOT NULL;

-- ============================================================
-- ÍNDICES PARA TABELA LEAD_TAGS (JOINs)
-- ============================================================

-- Índice para join em lead_tag_assignments
-- Otimiza: Query que busca tags de múltiplos leads (batch loading)
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_tag_assignments_lead_idx 
ON lead_tag_assignments(tenant_id, lead_id, tag_id);

-- Índice para filtro por tag slug (listagem por tag)
-- Otimiza: GET /api/leads?tags[]=X
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_tags_tenant_slug_idx 
ON lead_tags(tenant_id, slug);

-- ============================================================
-- ÍNDICES PARA TABELA AUDIT_LOGS
-- ============================================================

-- Índice composto para histórico do lead
-- Otimiza: GET /api/leads/:id/history
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_tenant_entity_created_idx 
ON audit_logs(tenant_id, entity_type, entity_id, created_at DESC);

-- Índice para auditoria por usuário actor
-- Otimiza: Relatórios de atividade por usuário
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_actor_created_idx 
ON audit_logs(tenant_id, actor_user_id, created_at DESC) 
WHERE actor_user_id IS NOT NULL;

-- ============================================================
-- ÍNDICES PARA TABELA LEAD_OPPORTUNITIES
-- ============================================================

-- Índice para join com leads
-- Otimiza: Query principal de leads que inclui opportunity data
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_opportunities_lead_idx 
ON lead_opportunities(tenant_id, lead_id, status);

-- Índice para oportunidades por estágio
-- Otimiza: Dashboard de funnel, conversão
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_opportunities_tenant_status_idx 
ON lead_opportunities(tenant_id, status, converted_at) 
WHERE status IN ('won', 'lost');

-- ============================================================
-- ÍNDICES PARA TABELA LEAD_ATTRIBUTIONS
-- ============================================================

-- Índice para lookup por lead_id (já usado na query detectLeadService)
-- Otimiza: Subquery lateral no leadSelect
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_attributions_lead_created_idx 
ON lead_attributions(lead_id, created_at DESC);

-- Índice para atribuição por campanha/formulário
-- Otimiza: Relatórios de origem de leads
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_attributions_tenant_source_idx 
ON lead_attributions(tenant_id, source_system, source_channel);

-- ============================================================
-- ÍNDICES PARA TABELA LEAD_STAGE_HISTORY
-- ============================================================

-- Índice para histórico de transições por lead
-- Otimiza: Análise de tempo em cada estágio
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_stage_history_lead_created_idx 
ON lead_stage_history(tenant_id, lead_id, created_at DESC);

-- Índice para contagem de transições por tenant/pipeline
-- Otimiza: Métricas de velocidade do pipeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_stage_history_tenant_pipeline_idx 
ON lead_stage_history(tenant_id, pipeline_key, to_stage, created_at);

-- ============================================================
-- ÍNDICES PARA TABELA USERS
-- ============================================================

-- Índice para busca de usuários ativos por tenant (lead routing)
-- Otimiza: resolveSdrOwnerId - query de usuários elegíveis
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_tenant_status_idx 
ON users(tenant_id, status) 
WHERE status = 'active';

-- ============================================================
-- ÍNDICES PARA TABELA USER_ROLES
-- ============================================================

-- Índice composto para verificação de permissões
-- Otimiza: getUserRole, verificações de admin
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_roles_user_tenant_idx 
ON user_roles(tenant_id, user_id, role_id);

-- ============================================================
-- ÍNDICES PARA TABELA ROLES
-- ============================================================

-- Índice para busca de roles por nome (tenant + name)
-- Otimiza: Verificações de permissão por role name
CREATE INDEX CONCURRENTLY IF NOT EXISTS roles_tenant_name_idx 
ON roles(tenant_id, lower(name));

-- ============================================================
-- ÍNDICES PARA TABELA TRACKING_EVENTS
-- ============================================================

-- Índice para processamento de eventos pendentes
-- Otimiza: Scripts de dispatch (meta-capi, webhooks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS tracking_events_status_retry_idx 
ON tracking_events(status, next_retry_at) 
WHERE status = 'queued' AND next_retry_at IS NOT NULL;

-- Índice para eventos por lead
-- Otimiza: Histórico de eventos enviados por lead
CREATE INDEX CONCURRENTLY IF NOT EXISTS tracking_events_lead_created_idx 
ON tracking_events(tenant_id, lead_id, created_at DESC);

-- ============================================================
-- ÍNDICES PARA TABELA PIPELINE_RULES_CONFIG
-- ============================================================

-- Índice para carregamento de regras por tenant/pipeline
-- Otimiza: loadPipelineRules em changeStage
CREATE INDEX CONCURRENTLY IF NOT EXISTS pipeline_rules_tenant_pipeline_idx 
ON pipeline_rules_config(tenant_id, pipeline_key);

-- ============================================================
-- ÍNDICES PARA TABELA LEAD_ROUTING (novo recurso)
-- ============================================================

-- Índice para regras ativas por tenant
-- Otimiza: resolveSdrOwnerId - busca regra ativa
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_routing_rules_tenant_active_idx 
ON lead_routing_rules(tenant_id, is_active) 
WHERE is_active = true;

-- Índice para assignments por regra
-- Otimiza: resolveUserByService - busca usuário por serviço
CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_routing_assignments_rule_idx 
ON lead_routing_rule_assignments(tenant_id, rule_key, config);

-- ============================================================
-- MANUTENÇÃO DE ÍNDICES (comentado, para referência futura)
-- ============================================================

-- Comandos úteis para manutenção:

-- Analisar uso de índices após deploy:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan ASC;

-- Identificar índices não utilizados:
-- SELECT indexrelid::regclass as index_name
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- AND indexrelid::regclass NOT LIKE '%_pkey';

-- Rebuild índice fragmentado:
-- REINDEX INDEX CONCURRENTLY leads_tenant_stage_owner_updated_idx;

-- Atualizar estatísticas do planner:
-- ANALYZE leads;
-- ANALYZE contacts;
-- ANALYZE lead_tag_assignments;

-- ============================================================
-- VALIDAÇÃO PÓS-DEPLOY
-- ============================================================

-- Após aplicar esta migration, execute:
-- EXPLAIN ANALYZE <query lenta>
-- Para verificar se os índices estão sendo usados (Index Scan vs Seq Scan)

-- Queries para testar:
-- 1. Listagem de leads com filtro de stage + owner
-- 2. Histórico de um lead específico
-- 3. Busca de leads por tags
-- 4. Join leads + opportunities + attributions
