-- Erreichbarkeits-Log der PDLs: jeder Anruf-Versuch des Teams bei einer PDL
-- (erreicht / nicht erreicht) — Basis für das PDL-Ranking im CRM-Admin.
create table if not exists public.pdl_versuche (
  id         uuid primary key default gen_random_uuid(),
  hub_id     uuid not null references public.hubs (id) on delete cascade,
  lead_kind  text,
  lead_id    text,
  erreicht   boolean not null,
  von        text,
  created_at timestamptz default now()
);
create index if not exists pdl_versuche_hub_idx on public.pdl_versuche (hub_id, created_at desc);
alter table public.pdl_versuche disable row level security;

notify pgrst, 'reload schema';
