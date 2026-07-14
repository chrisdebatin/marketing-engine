-- Marketing-Engine – initial schema
-- Run in the Supabase SQL editor or via `supabase db push`.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.hubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  region     text,
  created_at timestamptz not null default now()
);

-- One profile per auth user. Populated by the on-signup trigger below.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  role       text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- n:m employee <-> hub assignment
create table if not exists public.user_hubs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  hub_id  uuid not null references public.hubs (id) on delete cascade,
  primary key (user_id, hub_id)
);

-- Material catalog for the flyer activity (Flyer, Aufsteller, ...)
create table if not exists public.material_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order integer not null default 0
);

-- Suggestion list for the free-text Auslage-Ort autocomplete (imported via CSV).
create table if not exists public.standorte (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid not null references public.hubs (id) on delete cascade,
  name        text not null,
  typ         text,
  adresse     text,
  plz         text,
  ort         text,
  external_id text,
  created_at  timestamptz not null default now()
);

-- Dedup on re-import: external_id when present, else hub+name+adresse.
create unique index if not exists standorte_external_uidx
  on public.standorte (hub_id, external_id)
  where external_id is not null;
create unique index if not exists standorte_natural_uidx
  on public.standorte (hub_id, lower(name), lower(coalesce(adresse, '')));
create index if not exists standorte_hub_idx on public.standorte (hub_id);

-- Core activity log. Type-specific fields live in `details` (validated by Zod).
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  hub_id        uuid not null references public.hubs (id) on delete restrict,
  standort_name text not null,
  type          text not null check (type in ('flyer', 'box')),
  occurred_on   date not null default current_date,
  note          text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists activities_hub_idx on public.activities (hub_id);
create index if not exists activities_user_idx on public.activities (user_id);
create index if not exists activities_type_idx on public.activities (type);
create index if not exists activities_occurred_idx on public.activities (occurred_on);

-- ============================================================
-- Triggers
-- ============================================================

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
