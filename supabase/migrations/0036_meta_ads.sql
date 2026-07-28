-- 0036: Meta-Ads-Kampagnen (manuell gepflegt): allgemeine (gruppenweit)
-- und lokale (je Hub). "Läuft gerade" = start_date <= heute <= end_date
-- (end_date null = läuft bis auf Weiteres).
create table if not exists public.meta_ads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  typ         text not null check (typ in ('allgemein', 'lokal')),
  hub_id      uuid references public.hubs (id) on delete cascade,
  start_date  date not null default current_date,
  end_date    date,
  budget      text,
  ziel        text,
  link        text,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.meta_ads disable row level security;

notify pgrst, 'reload schema';
