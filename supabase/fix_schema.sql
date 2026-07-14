-- Marketing-Engine – Korrektur für eine teil-migrierte DB:
-- ersetzt die alte (leere) delivery_placements-Tabelle durch die hub-bezogene
-- Version und ergänzt die PDL-Felder + share_token an den Hubs.
-- Einmal im Supabase SQL-Editor ausführen.

-- 1) delivery_placements neu (alte, leere Tabelle ersetzen)
drop table if exists public.delivery_placements cascade;

create table public.delivery_placements (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid not null references public.hubs (id) on delete cascade,
  delivery_id   uuid references public.deliveries (id) on delete cascade,
  standort_name text not null,
  menge         integer,
  created_at    timestamptz not null default now()
);
create index if not exists delivery_placements_hub_idx
  on public.delivery_placements (hub_id);
create index if not exists delivery_placements_delivery_idx
  on public.delivery_placements (delivery_id);

alter table public.delivery_placements enable row level security;
drop policy if exists delivery_placements_select on public.delivery_placements;
create policy delivery_placements_select on public.delivery_placements
  for select using (public.has_hub(hub_id));

-- 2) Hubs: lokale PDL + stabiler Share-Token
alter table public.hubs add column if not exists pdl_name  text;
alter table public.hubs add column if not exists pdl_email text;
alter table public.hubs add column if not exists share_token text;

update public.hubs
  set share_token = replace(gen_random_uuid()::text, '-', '')
  where share_token is null;

alter table public.hubs
  alter column share_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.hubs
  alter column share_token set not null;

create unique index if not exists hubs_share_token_uidx
  on public.hubs (share_token);
