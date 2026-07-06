-- Migration 021: Performance Indexes for Query Optimization
-- Addresses N+1 queries and improves leadSelect performance
-- Safe to run multiple times (idempotent)

-- ============================================================================
-- INDEXES FOR LEAD SELECT OPTIMIZATION
-- ============================================================================

-- Composite index for leads list filtering by tenant, stage, and owner
-- Optimizes: WHERE l.tenant_id = $1 AND l.stage = ANY($2) AND l.sdr_owner_id = $3
create index if not exists leads_tenant_stage_owner_idx 
  on leads(tenant_id, stage, sdr_owner_id) 
  where sdr_owner_id is not null;

-- Composite index for leads by tenant and next_action_at (priority queue queries)
-- Optimizes: ORDER BY next_action_at DESC with tenant filtering
create index if not exists leads_tenant_next_action_idx 
  on leads(tenant_id, next_action_at desc) 
  where next_action_at is not null;

-- Composite index for leads by tenant and created_at (list queries)
-- Optimizes: WHERE tenant_id = $1 ORDER BY created_at DESC
create index if not exists leads_tenant_created_composite_idx 
  on leads(tenant_id, created_at desc);

-- Index for contact lookups in lead queries
-- Optimizes: JOIN contacts c ON c.tenant_id = l.tenant_id AND c.id = l.contact_id
create index if not exists contacts_tenant_id_idx 
  on contacts(tenant_id, id);

-- ============================================================================
-- INDEXES FOR OPPORTUNITY JOINS
-- ============================================================================

-- Composite index for lead_opportunities by tenant and lead_id
-- Optimizes: LEFT JOIN lead_opportunities lo ON lo.tenant_id = l.tenant_id AND lo.lead_id = l.id
create index if not exists lead_opportunities_tenant_lead_idx 
  on lead_opportunities(tenant_id, lead_id);

-- ============================================================================
-- INDEXES FOR TAG AGGREGATION (LATERAL JOIN)
-- ============================================================================

-- Composite index for lead_tag_assignments - critical for lateral join performance
-- Optimizes: WHERE lta.tenant_id = l.tenant_id AND lta.lead_id = l.id
create index if not exists lead_tag_assignments_tenant_lead_idx 
  on lead_tag_assignments(tenant_id, lead_id);

-- Index for tag lookups in tag aggregation
create index if not exists lead_tags_tenant_id_idx 
  on lead_tags(tenant_id, id);

-- ============================================================================
-- INDEXES FOR ATTRIBUTION JOINS (LATERAL JOIN)
-- ============================================================================

-- Composite index for lead_attributions - optimizes lateral join
-- Optimizes: WHERE la.tenant_id = l.tenant_id AND la.lead_id = l.id
create index if not exists lead_attributions_tenant_lead_idx 
  on lead_attributions(tenant_id, lead_id);

-- ============================================================================
-- INDEXES FOR PIPELINE STAGE JOINS
-- ============================================================================

-- Composite index for pipeline stages join
-- Optimizes: JOIN lead_pipeline_stages ON tenant_id, pipeline_key, key
create index if not exists lead_pipeline_stages_tenant_pipeline_key_idx 
  on lead_pipeline_stages(tenant_id, pipeline_key, key);

-- ============================================================================
-- INDEXES FOR USER/OWNER LOOKUPS
-- ============================================================================

-- Composite index for users by tenant and id (owner lookups)
-- Optimizes: JOIN users owner_user ON owner_user.tenant_id = l.tenant_id AND owner_user.id = l.sdr_owner_id
create index if not exists users_tenant_id_idx 
  on users(tenant_id, id);

-- ============================================================================
-- INDEXES FOR PROPOSALS MODULE
-- ============================================================================

-- Composite index for proposals by tenant, lead, and status
-- Optimizes: proposal listing and status filtering
create index if not exists proposals_tenant_lead_status_idx 
  on proposals(tenant_id, lead_id, status);

-- Index for proposal valid_until queries (expiration tracking)
create index if not exists proposals_valid_until_idx 
  on proposals(valid_until) 
  where status IN ('draft', 'sent');

-- ============================================================================
-- INDEXES FOR FOLLOW-UP QUEUE
-- ============================================================================

-- Composite index for follow-up queue by tenant, status, and scheduled_at
-- Optimizes: queue processing queries
create index if not exists follow_up_queue_tenant_status_scheduled_idx 
  on follow_up_queue(tenant_id, status, scheduled_at) 
  where status = 'pending';

-- ============================================================================
-- INDEXES FOR ACTIVITIES (HISTORY/TIMELINE)
-- ============================================================================

-- Composite index for activities by tenant, lead, and occurred_at
-- Optimizes: timeline/history queries
create index if not exists activities_tenant_lead_occurred_idx 
  on activities(tenant_id, lead_id, occurred_at desc);

-- Index for activity type filtering
create index if not exists activities_tenant_type_idx 
  on activities(tenant_id, activity_type, occurred_at desc);

-- ============================================================================
-- INDEXES FOR NOTIFICATIONS
-- ============================================================================

-- Composite index for notifications by tenant, user, and status
-- Optimizes: notification listing queries
create index if not exists notifications_tenant_user_status_idx 
  on notifications(tenant_id, user_id, status, created_at desc);

-- Index for unread notifications count
create index if not exists notifications_unread_idx 
  on notifications(tenant_id, user_id, created_at desc) 
  where status = 'unread';

-- ============================================================================
-- INDEXES FOR ANALYTICS/REPORTING
-- ============================================================================

-- Composite index for lead stage history (analytics queries)
create index if not exists lead_stage_history_tenant_stage_changed_idx 
  on lead_stage_history(tenant_id, from_stage, to_stage, changed_at desc);

-- Index for conversion tracking
create index if not exists lead_opportunities_tenant_converted_idx 
  on lead_opportunities(tenant_id, status, converted_at desc) 
  where status = 'won';

-- ============================================================================
-- COVERING INDEXES FOR FREQUENT QUERIES
-- ============================================================================

-- Covering index for lead list views (includes commonly selected columns)
-- Reduces need to access heap table for basic list views
create index if not exists leads_tenant_stage_covering_idx 
  on leads(tenant_id, stage, created_at desc) 
  include (contact_id, sdr_owner_id, priority, next_action_at)
  where stage NOT IN ('perdido');

-- ============================================================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================================================

-- Partial index for high-priority leads
create index if not exists leads_high_priority_idx 
  on leads(tenant_id, next_action_at) 
  where priority IN ('alta', 'urgente') AND stage NOT IN ('perdido', 'contrato_enervita');

-- Partial index for leads needing action (next_action_at in near future)
create index if not exists leads_action_needed_idx 
  on leads(tenant_id, next_action_at) 
  where next_action_at <= now() + interval '7 days' 
    AND next_action_at IS NOT NULL 
    AND stage NOT IN ('perdido', 'contrato_enervita');

-- Partial index for lost leads analysis
create index if not exists leads_lost_reason_idx 
  on leads(tenant_id, lost_reason) 
  where lost_reason IS NOT NULL;

-- ============================================================================
-- INDEXES FOR INTEGRATIONS MODULE
-- ============================================================================

-- Index for ad platform accounts by tenant and platform
create index if not exists ad_platform_accounts_tenant_platform_idx 
  on ad_platform_accounts(tenant_id, platform);

-- Index for ad campaigns by account and status
create index if not exists ad_campaigns_account_status_idx 
  on ad_campaigns(account_id, status, updated_at desc);

-- ============================================================================
-- INDEXES FOR SOLAR DIMENSIONING
-- ============================================================================

-- Index for dimensionamentos by tenant and status
create index if not exists dimensionamentos_tenant_status_idx 
  on dimensionamentos(tenant_id, status, created_at desc);

-- ============================================================================
-- DOCUMENTATION: Update schema_migrations
-- ============================================================================

insert into schema_migrations (version, description)
values ('021_performance_indexes', 'Performance indexes for query optimization and N+1 reduction')
on conflict (version) do nothing;

-- ============================================================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- ============================================================================

-- Note: In production, consider running ANALYZE during low-traffic periods
-- ANALYZE leads;
-- ANALYZE contacts;
-- ANALYZE lead_opportunities;
-- ANALYZE lead_tag_assignments;
-- ANALYZE lead_attributions;
-- ANALYZE proposals;
-- ANALYZE follow_up_queue;
-- ANALYZE activities;
-- ANALYZE notifications;
