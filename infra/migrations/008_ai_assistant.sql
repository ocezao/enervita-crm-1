insert into permissions (key, resource, action, description) values
  ('page.ai_assistant', 'page', 'ai_assistant', 'Permite abrir e usar o Assistente IA read-only do CRM')
on conflict (key) do update set resource = excluded.resource, action = excluded.action, description = excluded.description;

insert into schema_migrations (version, description) values ('008_ai_assistant', 'AI assistant page permission and OpenRouter/DeepSeek MVP') on conflict (version) do nothing;
