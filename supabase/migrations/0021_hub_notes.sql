-- Notizen je Hub/Standort; optional als offenes To-do markierbar und
-- abhakbar. RLS DISABLED — Zugriff ausschliesslich über den
-- Service-Role-Client, wie bei hub_tasks/orders.

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
