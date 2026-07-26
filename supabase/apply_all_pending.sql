-- Ausstehende DB-Änderungen (idempotent). In den Supabase SQL-Editor
-- einfügen und ausführen:
-- https://supabase.com/dashboard/project/xbzcplpaalccjiyjhypr/sql/new
--
-- Stand: nur noch 0027 offen — alles davor ist bereits eingespielt.

-- ── 0027: CRM-Kontakt-Log (Box/Besuch/Anruf, Ansprechpartner) ───────
alter table public.crm_targets
  add column if not exists ansprechpartner text;
alter table public.crm_targets
  add column if not exists letzte_kontakt_art text;
alter table public.crm_targets
  alter column intervall_wochen set default 4;

create table if not exists public.crm_contacts (
  id              uuid primary key default gen_random_uuid(),
  target_id       uuid not null references public.crm_targets (id) on delete cascade,
  hub_id          uuid references public.hubs (id) on delete set null,
  kontakt_art     text not null check (kontakt_art in ('box', 'besuch', 'anruf')),
  ansprechpartner text,
  note            text,
  contact_date    date not null default current_date,
  created_at      timestamptz default now()
);
create index if not exists crm_contacts_hub_date_idx
  on public.crm_contacts (hub_id, contact_date desc);
alter table public.crm_contacts disable row level security;

alter table public.crm_targets
  add column if not exists recare_partner boolean;
update public.crm_targets set recare_partner = true
  where note like '%Recare-Partner%' and recare_partner is null;

notify pgrst, 'reload schema';
select count(*) as crm_contacts_rows from public.crm_contacts;
