-- 0034: Frontoffice/Callcenter — jeder Interessenten-Anruf wird als Lead
-- geloggt: Quelle (woher aufmerksam geworden) + an welchen Standort/PDL
-- weitergeleitet wurde.
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
