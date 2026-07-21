-- Flyeraktionen: Log der durchgeführten Verteil-/Postwurf-Aktionen
-- (Datum, Anzahl, Ziel-PLZ (mehrere, Komma-getrennt), Inhalt/Motiv, Notiz).
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client,
-- wie bei orders/hub_tasks/patient_flows.

create table if not exists public.flyer_actions (
  id          uuid primary key default gen_random_uuid(),
  action_date date not null default current_date,
  anzahl      integer not null check (anzahl >= 0),
  plz         text not null,
  inhalt      text not null,
  note        text,
  hub_id      uuid references public.hubs (id) on delete set null,
  created_at  timestamptz default now()
);
create index if not exists flyer_actions_date_idx
  on public.flyer_actions (action_date desc);
alter table public.flyer_actions disable row level security;
