-- 0057: To-dos mit Deadline direkt am Lead ("ruf mich in 1 Woche zurück").
-- Ist ein To-do fällig, poppt der Lead in der Team-Inbox oben in der
-- Wiedervorlage-Gruppe auf. lead_kind/lead_id statt FK, weil Leads in zwei
-- Tabellen leben (lead_calls uuid, meta_leads text-ID).
create table if not exists public.lead_todos (
  id           uuid primary key default gen_random_uuid(),
  lead_kind    text not null check (lead_kind in ('call', 'meta')),
  lead_id      text not null,
  text         text not null,
  faellig_am   date,
  erledigt_at  timestamptz,
  erstellt_von text,
  created_at   timestamptz default now()
);
create index if not exists lead_todos_lead_idx on public.lead_todos (lead_kind, lead_id);
create index if not exists lead_todos_open_idx on public.lead_todos (faellig_am) where erledigt_at is null;
alter table public.lead_todos disable row level security;

notify pgrst, 'reload schema';
