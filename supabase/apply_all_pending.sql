-- Alle ausstehenden DB-Änderungen in EINEM Rutsch (idempotent, gefahrlos
-- mehrfach ausführbar). In den Supabase SQL-Editor einfügen und ausführen:
-- https://supabase.com/dashboard/project/xbzcplpaalccjiyjhypr/sql/new

-- ── 0017: Patienten-Zu-/Abgänge (Patienten-Meldung der PDLs) ────────
create table if not exists public.patient_flows (
  id           uuid primary key default gen_random_uuid(),
  hub_id       uuid not null references public.hubs (id) on delete cascade,
  period       text not null check (period ~ '^\d{4}-\d{2}$'),
  flow         text not null check (flow in ('zugang', 'abgang')),
  leistung     text not null,
  display_name text not null,
  reference_id text,
  abgang_grund text,
  event_date   date,
  note         text,
  created_at   timestamptz default now()
);
alter table public.patient_flows add column if not exists abgang_grund text;
alter table public.patient_flows add column if not exists event_date date;
create index if not exists patient_flows_hub_period_idx
  on public.patient_flows (hub_id, period);
alter table public.patient_flows disable row level security;

-- ── 0018: Orts-Kategorie für Auslage-/Liefer-Orte ───────────────────
alter table public.delivery_placements
  add column if not exists place_kind text;

-- ── 0020: Ortschaft (Stadt) für Auslage-/Liefer-Orte ────────────────
alter table public.delivery_placements
  add column if not exists ort text;

-- ── 0019: Flyeraktionen (Verteil-/Postwurf-Aktionen) ────────────────
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

-- ── 0021: Notizen & To-dos je Hub ───────────────────────────────────
create table if not exists public.hub_notes (
  id         uuid primary key default gen_random_uuid(),
  hub_id     uuid not null references public.hubs (id) on delete cascade,
  text       text not null,
  is_todo    boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz default now()
);
create index if not exists hub_notes_hub_idx on public.hub_notes (hub_id);
alter table public.hub_notes disable row level security;

-- PostgREST-Schema-Cache neu laden, damit die API alles sofort kennt.
notify pgrst, 'reload schema';

-- Kontrolle: beide Abfragen müssen ohne Fehler durchlaufen.
select count(*) as patient_flows_rows from public.patient_flows;
select count(*) as placements_mit_kategorie
  from public.delivery_placements where place_kind is not null;
