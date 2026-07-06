-- ============================================================================
-- QUERY MONITORING AND PERFORMANCE ANALYSIS SCRIPTS
-- Run these queries periodically to identify slow queries and optimization opportunities
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. IDENTIFY SLOW QUERIES FROM PG_STAT_STATEMENTS
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- ----------------------------------------------------------------------------

-- Top 10 slowest queries by total time
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Top 10 queries by total time (most impactful)
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- 2. INDEX USAGE ANALYSIS
-- ----------------------------------------------------------------------------

-- Identify unused indexes (candidates for removal)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Index usage efficiency
SELECT 
    relname as table_name,
    indexrelname as index_name,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ----------------------------------------------------------------------------
-- 3. TABLE SCAN ANALYSIS (identify missing indexes)
-- ----------------------------------------------------------------------------

-- Tables with high sequential scan count (may need indexes)
SELECT 
    relname as table_name,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE 
        WHEN seq_scan > 0 AND idx_scan = 0 THEN 'CONSIDER ADDING INDEX'
        WHEN seq_scan > idx_scan * 10 THEN 'REVIEW INDEX STRATEGY'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- ----------------------------------------------------------------------------
-- 4. CONNECTION POOL MONITORING
-- ----------------------------------------------------------------------------

-- Current connection pool status
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    count(*) FILTER (WHERE state = 'fastpath function call') as fastpath_calls,
    count(*) FILTER (WHERE state = 'disabled') as disabled
FROM pg_stat_activity;

-- Connections by database
SELECT 
    datname,
    count(*) as connection_count,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
GROUP BY datname
ORDER BY connection_count DESC;

-- Long-running queries (potential issues)
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    now() - query_start as duration,
    left(query, 200) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- ----------------------------------------------------------------------------
-- 5. CACHE HIT RATIO (critical for performance)
-- ----------------------------------------------------------------------------

-- Overall cache hit ratio (should be > 95%)
SELECT 
    sum(heap_blks_hit) as heap_hits,
    sum(heap_blks_read) as heap_reads,
    100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Cache hit ratio by table
SELECT 
    relname as table_name,
    heap_blks_hit,
    heap_blks_read,
    100.0 * heap_blks_hit / nullif(heap_blks_hit + heap_blks_read, 0) as cache_hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY cache_hit_ratio ASC;

-- ----------------------------------------------------------------------------
-- 6. LOCK MONITORING
-- ----------------------------------------------------------------------------

-- Current locks and waiting queries
SELECT 
    blocked_locks.pid as blocked_pid,
    blocked_activity.usename as blocked_user,
    blocking_locks.pid as blocking_pid,
    blocking_activity.usename as blocking_user,
    blocked_activity.query as blocked_query,
    blocking_activity.query as blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ----------------------------------------------------------------------------
-- 7. TABLE BLOAT ANALYSIS
-- ----------------------------------------------------------------------------

-- Estimate table bloat (simplified)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    n_dead_tup,
    n_live_tup,
    CASE 
        WHEN n_live_tup > 0 
        THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0 
    END as dead_tuple_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- ----------------------------------------------------------------------------
-- 8. SPECIFIC ENERVITA CRM QUERIES PERFORMANCE
-- ----------------------------------------------------------------------------

-- Lead query performance metrics (requires pg_stat_statements)
SELECT 
    calls,
    mean_exec_time,
    total_exec_time,
    rows,
    query
FROM pg_stat_statements
WHERE query LIKE '%leads%' 
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 5;

-- Proposal query performance
SELECT 
    calls,
    mean_exec_time,
    total_exec_time,
    query
FROM pg_stat_statements
WHERE query LIKE '%proposals%' 
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 5;

-- ----------------------------------------------------------------------------
-- 9. RECOMMENDATIONS OUTPUT
-- ----------------------------------------------------------------------------

-- Generate recommendations based on current stats
SELECT 
    'HIGH PRIORITY' as priority,
    'Add covering index for leads list queries' as recommendation,
    'CREATE INDEX leads_tenant_stage_covering_idx ON leads(tenant_id, stage, created_at desc) INCLUDE (contact_id, sdr_owner_id, priority);' as action
WHERE EXISTS (
    SELECT 1 FROM pg_stat_user_tables 
    WHERE relname = 'leads' AND seq_scan > idx_scan * 5
)
UNION ALL
SELECT 
    'MEDIUM PRIORITY',
    'Run VACUUM ANALYZE on frequently updated tables',
    'VACUUM ANALYZE leads, contacts, activities;'
WHERE EXISTS (
    SELECT 1 FROM pg_stat_user_tables 
    WHERE relname IN ('leads', 'contacts', 'activities') 
    AND (last_vacuum IS NULL OR last_vacuum < now() - interval '7 days')
)
UNION ALL
SELECT 
    'LOW PRIORITY',
    'Review unused indexes for potential removal',
    'See index usage analysis query above'
WHERE EXISTS (
    SELECT 1 FROM pg_stat_user_indexes 
    WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey'
);
