-- Ausstehende DB-Änderungen (idempotent). In den Supabase SQL-Editor
-- einfügen und ausführen:
-- https://supabase.com/dashboard/project/xbzcplpaalccjiyjhypr/sql/new
--
-- Stand: offen sind 0030–0033 — alles davor ist eingespielt.
-- (Bereits eingespielte Blöcke werden dank "if not exists" einfach übersprungen.)

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

-- ── 0033: Wöchentliche Kapazitäts-Meldung je Hub ────────────────────
create table if not exists public.capacity_reports (
  id                uuid primary key default gen_random_uuid(),
  hub_id            uuid not null references public.hubs (id) on delete cascade,
  week_start        date not null,
  freie_plaetze     integer not null default 0 check (freie_plaetze between 0 and 99),
  beatmung_plaetze  integer not null default 0 check (beatmung_plaetze between 0 and 99),
  wg_plaetze        integer not null default 0 check (wg_plaetze between 0 and 99),
  kinder_moeglich   boolean not null default false,
  aufnahme_ab       date,
  notiz             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (hub_id, week_start)
);
alter table public.capacity_reports disable row level security;

notify pgrst, 'reload schema';

-- ── 0034: Frontoffice — Lead-Calls (Quelle + weitergeleiteter Standort) ─
create table if not exists public.lead_calls (
  id          uuid primary key default gen_random_uuid(),
  call_date   date not null default current_date,
  quelle      text not null,
  bereich     text,
  quelle_detail text,
  lead_name   text,
  hub_id      uuid references public.hubs (id) on delete set null,
  notiz       text,
  created_at  timestamptz default now()
);
create index if not exists lead_calls_date_idx on public.lead_calls (call_date desc);
alter table public.lead_calls disable row level security;

notify pgrst, 'reload schema';

-- ── 0035: Bereich, Quelle-Detail und Lead-Name für Lead-Calls ───────
alter table public.lead_calls add column if not exists bereich text;
alter table public.lead_calls add column if not exists quelle_detail text;
alter table public.lead_calls add column if not exists lead_name text;

notify pgrst, 'reload schema';

-- ── 0036: Meta-Ads-Kampagnen (allgemein + lokal je Hub) ─────────────
create table if not exists public.meta_ads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  typ         text not null check (typ in ('allgemein', 'lokal')),
  hub_id      uuid references public.hubs (id) on delete cascade,
  start_date  date not null default current_date,
  end_date    date,
  budget      text,
  ziel        text,
  link        text,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.meta_ads disable row level security;

notify pgrst, 'reload schema';
