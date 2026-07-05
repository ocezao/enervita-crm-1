// Nota: 010_meta_leadgen_events foi aplicada em producao mas o arquivo foi removido do repo.
// Esta migration e historica — nao recriar. O schema_migrations ja a registra.
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
  'infra/migrations/019_lead_routing.sql',
  'infra/migrations/020_multi_pipelines.sql',
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

export const requiredEnums = [
  'lead_stage',
  'priority_level',
  'task_status',
  'activity_type',
  'delivery_status',
  'permission_effect',
];

export const requiredNotNullColumns = {
  tenants: ['slug', 'name'],
  users: ['tenant_id', 'email'],
  leads: ['tenant_id', 'stage'],
  notifications: ['tenant_id', 'user_id', 'type', 'metadata'],
  follow_up_queue: ['tenant_id', 'lead_id', 'rule_key', 'status'],
};

export const requiredConstraints = [
  'users_tenant_email_unique',
  'users_id_tenant_unique',
  'roles_tenant_name_unique',
  'contacts_id_tenant_unique',
  'leads_contact_tenant_fk',
  'tasks_lead_tenant_fk',
  'activities_lead_tenant_fk',
  'tracking_events_lead_tenant_fk',
];
