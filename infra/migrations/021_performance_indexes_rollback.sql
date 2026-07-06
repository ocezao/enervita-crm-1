# Script de Rollback para Índices de Performance (Opcional)
-- Migration 021 Rollback: Remove performance indexes se necessário
-- Use este script apenas em caso de problemas críticos após deploy
-- ============================================================================

-- Nota: Em produção, considere o impacto de remover índices antes de executar
-- Índices podem ser removidos individualmente sem afetar dados

-- ============================================================================
-- DROP INDEXES FOR LEAD SELECT OPTIMIZATION
-- ============================================================================

drop index if exists leads_tenant_stage_owner_idx;
drop index if exists leads_tenant_next_action_idx;
drop index if exists leads_tenant_created_composite_idx;
drop index if exists contacts_tenant_id_idx;

-- ============================================================================
-- DROP INDEXES FOR OPPORTUNITY JOINS
-- ============================================================================

drop index if exists lead_opportunities_tenant_lead_idx;

-- ============================================================================
-- DROP INDEXES FOR TAG AGGREGATION (LATERAL JOIN)
-- ============================================================================

drop index if exists lead_tag_assignments_tenant_lead_idx;
drop index if exists lead_tags_tenant_id_idx;

-- ============================================================================
-- DROP INDEXES FOR ATTRIBUTION JOINS (LATERAL JOIN)
-- ============================================================================

drop index if exists lead_attributions_tenant_lead_idx;

-- ============================================================================
-- DROP INDEXES FOR PIPELINE STAGE JOINS
-- ============================================================================

drop index if exists lead_pipeline_stages_tenant_pipeline_key_idx;

-- ============================================================================
-- DROP INDEXES FOR USER/OWNER LOOKUPS
-- ============================================================================

drop index if exists users_tenant_id_idx;

-- ============================================================================
-- DROP INDEXES FOR PROPOSALS MODULE
-- ============================================================================

drop index if exists proposals_tenant_lead_status_idx;
drop index if exists proposals_valid_until_idx;

-- ============================================================================
-- DROP INDEXES FOR FOLLOW-UP QUEUE
-- ============================================================================

drop index if exists follow_up_queue_tenant_status_scheduled_idx;

-- ============================================================================
-- DROP INDEXES FOR ACTIVITIES (HISTORY/TIMELINE)
-- ============================================================================

drop index if exists activities_tenant_lead_occurred_idx;
drop index if exists activities_tenant_type_idx;

-- ============================================================================
-- DROP INDEXES FOR NOTIFICATIONS
-- ============================================================================

drop index if exists notifications_tenant_user_status_idx;
drop index if exists notifications_unread_idx;

-- ============================================================================
-- DROP INDEXES FOR ANALYTICS/REPORTING
-- ============================================================================

drop index if exists lead_stage_history_tenant_stage_changed_idx;
drop index if exists lead_opportunities_tenant_converted_idx;

-- ============================================================================
-- DROP COVERING INDEXES
-- ============================================================================

drop index if exists leads_tenant_stage_covering_idx;

-- ============================================================================
-- DROP PARTIAL INDEXES
-- ============================================================================

drop index if exists leads_high_priority_idx;
drop index if exists leads_action_needed_idx;
drop index if exists leads_lost_reason_idx;

-- ============================================================================
-- DROP INDEXES FOR INTEGRATIONS MODULE
-- ============================================================================

drop index if exists ad_platform_accounts_tenant_platform_idx;
drop index if exists ad_campaigns_account_status_idx;

-- ============================================================================
-- DROP INDEXES FOR SOLAR DIMENSIONING
-- ============================================================================

drop index if exists dimensionamentos_tenant_status_idx;

-- ============================================================================
-- REMOVER REGISTRO DO SCHEMA_MIGRATIONS
-- ============================================================================

delete from schema_migrations where version = '021_performance_indexes';

-- ============================================================================
-- NOTA: Após remover índices, execute ANALYZE para atualizar estatísticas
-- ============================================================================

-- ANALYZE leads;
-- ANALYZE contacts;
-- ANALYZE lead_opportunities;
-- ANALYZE lead_tag_assignments;
-- ANALYZE lead_attributions;
-- ANALYZE proposals;
-- ANALYZE follow_up_queue;
-- ANALYZE activities;
-- ANALYZE notifications;

-- ============================================================================
-- FIM DO SCRIPT DE ROLLBACK
-- ============================================================================
