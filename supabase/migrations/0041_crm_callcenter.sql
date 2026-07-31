-- 0041: CRM-Ausbau für das Call-Center —
-- a) crm_persons: mehrere Ansprechpartner je Ziel-Ort (Name, Funktion,
--    Telefon, E-Mail) statt des einen Freitextfelds.
-- b) crm_targets.geo_tag: geografischer Tag (aus Ort/Hub abgeleitet,
--    editierbar) zum Filtern der Anruf-Listen.
-- c) lead_calls.target_id: eingehende Leads mit der Quell-Institution
--    verknüpfen; Kontakt-Art 'lead' im Log erlaubt, damit die
--    Institutions-Historie auch eingegangene Leads zeigt.
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client.

create table if not exists public.crm_persons (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.crm_targets (id) on delete cascade,
  name       text not null,
  funktion   text,
  telefon    text,
  email      text,
  notiz      text,
  created_at timestamptz default now()
);
create index if not exists crm_persons_target_idx on public.crm_persons (target_id);
alter table public.crm_persons disable row level security;

alter table public.crm_targets add column if not exists geo_tag text;

alter table public.lead_calls
  add column if not exists target_id uuid references public.crm_targets (id) on delete set null;

alter table public.crm_contacts drop constraint if exists crm_contacts_kontakt_art_check;
alter table public.crm_contacts add constraint crm_contacts_kontakt_art_check
  check (kontakt_art in ('box', 'flyer', 'besuch', 'anruf', 'lead'));

notify pgrst, 'reload schema';
