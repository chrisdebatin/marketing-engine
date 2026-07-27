-- Ausstehende DB-Änderungen (idempotent). In den Supabase SQL-Editor
-- einfügen und ausführen:
-- https://supabase.com/dashboard/project/xbzcplpaalccjiyjhypr/sql/new
--
-- Stand: nur noch 0030 offen — alles davor (bis inkl. 0029) ist eingespielt.

-- ── 0030: Relevanz-Kategorie (1–3) für CRM-Ziel-Orte ────────────────
alter table public.crm_targets add column if not exists relevanz smallint
  check (relevanz between 1 and 3);

-- Importierte Orte tragen "Relevanz X" in der note — in die Spalte übernehmen.
update public.crm_targets
  set relevanz = (substring(note from 'Relevanz ([1-3])'))::smallint
  where relevanz is null and note ~ 'Relevanz [1-3]';

notify pgrst, 'reload schema';
select count(*) as targets_mit_relevanz from public.crm_targets where relevanz is not null;

-- ── 0031: App-Einstellungen (Follow-up-Rhythmus je Kontakt-Art) ─────
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings disable row level security;

notify pgrst, 'reload schema';

-- ── 0032: Anruf-Daten aus der Telefonanlage (CSV-Upload) ────────────
create table if not exists public.phone_calls (
  id               uuid primary key default gen_random_uuid(),
  call_id          text unique not null,
  call_time        timestamptz not null,
  hub_name         text,
  direction        text not null check (direction in ('inbound', 'outbound', 'internal')),
  answered         boolean not null default false,
  talking_seconds  integer not null default 0,
  created_at       timestamptz default now()
);
create index if not exists phone_calls_time_idx on public.phone_calls (call_time desc);
alter table public.phone_calls disable row level security;

notify pgrst, 'reload schema';
