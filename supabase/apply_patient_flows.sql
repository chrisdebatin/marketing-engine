-- One-off: Patienten-Zu-/Abgänge (0017) auf einer bestehenden DB einspielen.
-- In den Supabase SQL-Editor einfügen und ausführen.

create table if not exists public.patient_flows (
  id           uuid primary key default gen_random_uuid(),
  hub_id       uuid not null references public.hubs (id) on delete cascade,
  period       text not null check (period ~ '^\d{4}-\d{2}$'),
  flow         text not null check (flow in ('zugang', 'abgang')),
  leistung     text not null,
  display_name text not null,
  reference_id text,
  -- Pflicht bei flow='abgang': Grund-Schlüssel (z. B. verstorben, umzug).
  abgang_grund text,
  -- Datum des Ereignisses (bei Neuaufnahmen: Aufnahmedatum).
  event_date   date,
  note         text,
  created_at   timestamptz default now()
);
-- Falls die Tabelle schon ohne die Spalte existiert: nachziehen.
alter table public.patient_flows add column if not exists abgang_grund text;
alter table public.patient_flows add column if not exists event_date date;
create index if not exists patient_flows_hub_period_idx
  on public.patient_flows (hub_id, period);
alter table public.patient_flows disable row level security;

-- PostgREST-Schema-Cache neu laden, damit die API die Tabelle sofort kennt.
notify pgrst, 'reload schema';

-- Kontrolle: muss 0 (oder mehr) liefern, nicht mit einem Fehler abbrechen.
select count(*) as patient_flows_rows from public.patient_flows;
