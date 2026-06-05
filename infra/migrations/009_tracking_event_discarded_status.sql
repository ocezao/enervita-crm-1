-- Allow queued tracking events to be discarded when a newer manual Kanban move supersedes them.
-- This prevents accidental drag/drop corrections from being counted as Meta/CAPI failures.

alter type delivery_status add value if not exists 'discarded';

insert into schema_migrations (version, description)
values ('009_tracking_event_discarded_status', 'Add discarded delivery status for superseded tracking events')
on conflict (version) do nothing;
