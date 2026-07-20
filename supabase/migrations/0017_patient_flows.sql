-- Patienten-Bewegungen: PDLs erfassen monatlich Neuaufnahmen (Zugang) und
-- abgegangene Patienten (Abgang) je SGB-Leistungsart über ihren Hub-Link.
-- DSGVO — Datenminimierung: nur Anzeigename + optionale Referenz-ID.
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client
-- (createAdminClient), wie bei `orders`/`hub_tasks`/`patient_records`.

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
create index if not exists patient_flows_hub_period_idx
  on public.patient_flows (hub_id, period);
alter table public.patient_flows disable row level security;
