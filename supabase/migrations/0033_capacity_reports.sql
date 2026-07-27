-- 0033: Wöchentliche Kapazitäts-Meldung je Hub (durch die PDL).
-- Datenbasis für Kapazitäts-Report und perspektivisch die automatische
-- Annahme von Recare-Anfragen. Ein Datensatz je Hub und Kalenderwoche.
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
