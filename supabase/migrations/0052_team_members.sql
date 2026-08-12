-- 0052: CRM-Ausbau Stufe 1 — persönliche Team-Links + Claim/Status.
-- team_members: Davina (Call-Center Indien), Belinda + Adelina (Kundenservice
-- DE). Jede(r) bekommt einen persönlichen Token-Link (/t/<token>); alle
-- Log-Einträge tragen den Namen ("wer ruft wann wen an").
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  team       text not null check (team in ('kundenservice', 'callcenter')),
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  active     boolean not null default true,
  created_at timestamptz default now()
);
alter table public.team_members disable row level security;

insert into public.team_members (name, team)
select v.name, v.team
from (values
  ('Belinda', 'kundenservice'),
  ('Adelina', 'kundenservice'),
  ('Davina',  'callcenter')
) as v(name, team)
where not exists (select 1 from public.team_members m where m.name = v.name);

-- Claim ("übernommen von") + B2C-Funnel-Status an beiden Lead-Tabellen.
-- Funnel: offen → kontaktiert → erstgespraech (= gewonnen, Stand Jahr 1)
-- | verloren; Recare-Leads springen direkt auf aufgenommen.
alter table public.lead_calls add column if not exists bearbeiter text;
alter table public.lead_calls add column if not exists status text not null default 'offen'
  check (status in ('offen', 'kontaktiert', 'erstgespraech', 'aufgenommen', 'verloren'));
alter table public.lead_calls add column if not exists telefon text;
alter table public.lead_calls add column if not exists email text;

alter table public.meta_leads add column if not exists bearbeiter text;
alter table public.meta_leads drop constraint if exists meta_leads_status_check;
alter table public.meta_leads add constraint meta_leads_status_check
  check (status in ('offen', 'kontaktiert', 'erstgespraech', 'aufgenommen', 'verloren', 'geloescht'));

-- Outbound: wer hat angerufen (Kontakt-Log um Person ergänzt).
alter table public.crm_contacts add column if not exists bearbeiter text;

notify pgrst, 'reload schema';
