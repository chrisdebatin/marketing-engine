-- 0031: App-Einstellungen (Key-Value) — z. B. Follow-up-Rhythmus je
-- Kontakt-Art (Box/Flyer: 8 Wochen, Besuch/Anruf: 4; im CRM einstellbar).
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings disable row level security;

notify pgrst, 'reload schema';
