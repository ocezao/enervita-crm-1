-- Store editable proposal content, reusable template flags and imported files.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_source_type') then
    create type proposal_source_type as enum ('editor', 'file');
  end if;
end $$;

alter table proposals
  add column if not exists source_type proposal_source_type not null default 'editor',
  add column if not exists content_html text,
  add column if not exists content_text text,
  add column if not exists template_name text,
  add column if not exists is_template boolean not null default false,
  add column if not exists imported_file_name text,
  add column if not exists imported_file_mime_type text,
  add column if not exists imported_file_size integer,
  add column if not exists imported_file_data bytea;

create index if not exists proposals_template_idx on proposals(tenant_id, is_template, updated_at desc) where is_template = true;

insert into schema_migrations (version, description)
values ('011_proposal_content', 'Proposal editor content templates and imported files')
on conflict (version) do nothing;
