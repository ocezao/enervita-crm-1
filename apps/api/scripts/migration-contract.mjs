export const migrationFiles = [
  'infra/migrations/001_initial_schema.sql',
  'infra/migrations/002_user_stage_permissions.sql',
  'infra/migrations/003_proposals.sql',
  'infra/migrations/004_controlled_integrations.sql',
  'infra/migrations/005_ads_overview.sql',
  'infra/migrations/006_ad_platform_account_metadata.sql',
  'infra/migrations/007_lead_tags.sql',
  'infra/migrations/008_ai_assistant.sql',
  'infra/migrations/009_tracking_event_discarded_status.sql',
  'infra/migrations/011_proposal_content.sql',
  'infra/migrations/012_lead_opportunities.sql',
  'infra/migrations/012_notifications.sql',
  'infra/migrations/013_opportunity_proposal_contract.sql',
  'infra/migrations/014_follow_up_queue.sql',
];

export const migrationFile = migrationFiles[0];

export const requiredTables = [
  'tenants', 'users', 'roles', 'user_roles', 'permissions',
  'contacts', 'leads', 'tasks', 'activities', 'tracking_events',
  'proposals', 'lead_opportunities', 'notifications', 'follow_up_queue',
];

export const requiredColumns = {
  tenants: ['id', 'slug', 'name'],
  users: ['id', 'tenant_id', 'email', 'password_hash'],
  leads: ['id', 'tenant_id', 'stage'],
  notifications: ['id', 'tenant_id', 'user_id', 'type', 'metadata'],
  follow_up_queue: ['id', 'tenant_id', 'lead_id', 'rule_key', 'status'],
};
