-- Hub-Aufgaben (Status je Hub, z. B. E-Mail verschickt).
-- Einmal im Supabase SQL-Editor einfuegen und ausfuehren. Idempotent.

-- Hub-Aufgaben: frei definierbare Aufgaben/Tags, die pro Hub abgehakt werden
-- (z. B. "E-Mail mit PDL-Link verschickt"). Eine Aufgabe gilt fuer alle Hubs;
-- ein Check-Eintrag (task_id, hub_id) bedeutet "fuer diesen Hub erledigt".
-- RLS DISABLED — Zugriff ausschliesslich ueber den Service-Role-Client
-- (createAdminClient), wie bei `orders` (0010).

create table if not exists public.hub_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  created_at  timestamptz default now()
);
alter table public.hub_tasks disable row level security;

create table if not exists public.hub_task_checks (
  task_id    uuid not null references public.hub_tasks (id) on delete cascade,
  hub_id     uuid not null references public.hubs (id) on delete cascade,
  note       text,
  done_at    timestamptz not null default now(),
  primary key (task_id, hub_id)
);
create index if not exists hub_task_checks_hub_idx on public.hub_task_checks (hub_id);
alter table public.hub_task_checks disable row level security;

-- Seed (idempotent): die erste Aufgabe — Erklaerungs-Mail mit PDL-Link.
insert into public.hub_tasks (title, description)
select 'E-Mail mit PDL-Link verschickt',
       'Erklaerungs-Mail mit dem persoenlichen Link an die PDL des Hubs gesendet.'
where not exists (
  select 1 from public.hub_tasks where title = 'E-Mail mit PDL-Link verschickt'
);
