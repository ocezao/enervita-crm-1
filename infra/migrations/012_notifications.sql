create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  title text not null,
  body text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_user_created_idx
  on notifications (tenant_id, user_id, created_at desc);

create index if not exists notifications_unread_idx
  on notifications (tenant_id, user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_task_idx
  on notifications (tenant_id, task_id)
  where task_id is not null;

insert into permissions (key, resource, action, description) values
  ('notification.view', 'notification', 'view', 'Visualizar notificações internas')
on conflict (key) do nothing;
