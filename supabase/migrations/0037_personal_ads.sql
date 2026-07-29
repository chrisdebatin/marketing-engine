-- 0037: Personal-Anzeigen (Recruiting) je Hub — auf welchen Plattformen
-- (Meta, Join, Indeed, …) läuft gerade eine Stellenanzeige.
-- hub_id null = Anzeige für alle Standorte.
create table if not exists public.personal_ads (
  id          uuid primary key default gen_random_uuid(),
  titel       text not null,
  plattform   text not null,
  hub_id      uuid references public.hubs (id) on delete cascade,
  start_date  date not null default current_date,
  end_date    date,
  link        text,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.personal_ads disable row level security;

notify pgrst, 'reload schema';
