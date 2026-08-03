-- 0042: KI-To-dos aus Call-Center-Notizen —
-- Claude liest jede Gesprächsnotiz aus und legt daraus Aufgaben für den
-- zuständigen Standort an (z. B. "PDL vorbeischicken"). Die PDL sieht sie
-- auf ihrem Dashboard (Tab "Aufträge") inkl. Kontext, was besprochen wurde.
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client.

create table if not exists public.crm_todos (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid not null references public.crm_targets (id) on delete cascade,
  hub_id      uuid references public.hubs (id) on delete set null,
  contact_id  uuid references public.crm_contacts (id) on delete set null,
  art         text not null default 'besuch'
    check (art in ('besuch', 'box', 'flyer', 'anruf', 'sonstiges')),
  aufgabe     text not null,
  besprochen  text,
  status      text not null default 'offen' check (status in ('offen', 'erledigt')),
  created_at  timestamptz default now(),
  done_at     timestamptz
);
create index if not exists crm_todos_hub_status_idx on public.crm_todos (hub_id, status);
create index if not exists crm_todos_contact_idx on public.crm_todos (contact_id);
alter table public.crm_todos disable row level security;

notify pgrst, 'reload schema';
