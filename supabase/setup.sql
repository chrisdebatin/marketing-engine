-- Marketing-Engine: komplettes Setup (Schema + RLS + Seed)
-- Einmal im Supabase SQL-Editor einfuegen und ausfuehren.
-- AUTO-GENERIERT aus supabase/migrations/*.sql + seed.sql. Nicht von Hand editieren.

-- ============================================================
-- 0001_init.sql
-- ============================================================
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


-- ============================================================
-- 0002_rls.sql
-- ============================================================
-- Marketing-Engine – Row Level Security

-- ============================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- true if the current user is admin OR assigned to the given hub
create or replace function public.has_hub(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.user_hubs
    where user_id = auth.uid() and hub_id = hid
  );
$$;

-- ============================================================
-- Enable RLS
-- ============================================================

alter table public.hubs           enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_hubs      enable row level security;
alter table public.material_types enable row level security;
alter table public.standorte      enable row level security;
alter table public.activities     enable row level security;

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- hubs  (read: members/admin; write: admin only)
-- ============================================================
drop policy if exists hubs_select on public.hubs;
create policy hubs_select on public.hubs
  for select using (public.has_hub(id));

drop policy if exists hubs_admin_write on public.hubs;
create policy hubs_admin_write on public.hubs
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- user_hubs  (read own; admin manages)
-- ============================================================
drop policy if exists user_hubs_select on public.user_hubs;
create policy user_hubs_select on public.user_hubs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_hubs_admin_write on public.user_hubs;
create policy user_hubs_admin_write on public.user_hubs
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- material_types  (read: any authenticated; write: admin)
-- ============================================================
drop policy if exists material_types_select on public.material_types;
create policy material_types_select on public.material_types
  for select using (auth.role() = 'authenticated');

drop policy if exists material_types_admin_write on public.material_types;
create policy material_types_admin_write on public.material_types
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- standorte  (read: hub members; write: admin/import)
-- ============================================================
drop policy if exists standorte_select on public.standorte;
create policy standorte_select on public.standorte
  for select using (public.has_hub(hub_id));

drop policy if exists standorte_admin_write on public.standorte;
create policy standorte_admin_write on public.standorte
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- activities
--   read:   hub members + admin (hub-wide visibility)
--   insert: hub members, only as themselves
--   update/delete: own entries + admin
-- ============================================================
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select using (public.has_hub(hub_id));

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert with check (public.has_hub(hub_id) and user_id = auth.uid());

drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities
  for delete using (user_id = auth.uid() or public.is_admin());


-- ============================================================
-- 0003_hubs_md.sql
-- ============================================================
-- Add the responsible MD (person accountable for the hub) to hubs.
alter table public.hubs
  add column if not exists responsible_md text;


-- ============================================================
-- 0004_deliveries.sql
-- ============================================================
-- Marketing-Engine – deliveries (MD liefert an Hub) + placements (wo die Flyer
-- ausgelegt wurden; eingetragen per Share-Link ohne Login).

create table if not exists public.deliveries (
  id           uuid primary key default gen_random_uuid(),
  hub_id       uuid not null references public.hubs (id) on delete restrict,
  delivered_by uuid references public.profiles (id) on delete set null default auth.uid(),
  flyer_count  integer not null default 0,
  box_count    integer not null default 0,
  note         text,
  share_token  text not null unique,
  created_at   timestamptz not null default now()
);
create index if not exists deliveries_hub_idx on public.deliveries (hub_id);
create index if not exists deliveries_token_idx on public.deliveries (share_token);

-- Placements are hub-scoped; a delivery reference is optional (a hub-level PDL
-- link records placements with delivery_id = null).
create table if not exists public.delivery_placements (
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

-- ============================================================
-- RLS. Public link writes go through the service role (bypasses RLS);
-- these policies only govern logged-in access.
-- ============================================================
alter table public.deliveries          enable row level security;
alter table public.delivery_placements enable row level security;

drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries
  for select using (public.has_hub(hub_id));

drop policy if exists deliveries_insert on public.deliveries;
create policy deliveries_insert on public.deliveries
  for insert with check (public.has_hub(hub_id) and delivered_by = auth.uid());

drop policy if exists deliveries_update on public.deliveries;
create policy deliveries_update on public.deliveries
  for update using (delivered_by = auth.uid() or public.is_admin())
  with check (delivered_by = auth.uid() or public.is_admin());

drop policy if exists deliveries_delete on public.deliveries;
create policy deliveries_delete on public.deliveries
  for delete using (delivered_by = auth.uid() or public.is_admin());

drop policy if exists delivery_placements_select on public.delivery_placements;
create policy delivery_placements_select on public.delivery_placements
  for select using (public.has_hub(hub_id));


-- ============================================================
-- 0005_hub_pdl.sql
-- ============================================================
-- Local PDL (Pflege-Dienstleitung) contact per hub + a stable share token for
-- the per-hub PDL link.

alter table public.hubs add column if not exists pdl_name  text;
alter table public.hubs add column if not exists pdl_email text;
alter table public.hubs add column if not exists share_token text;

-- backfill tokens for existing hubs
update public.hubs
  set share_token = replace(gen_random_uuid()::text, '-', '')
  where share_token is null;

alter table public.hubs
  alter column share_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.hubs
  alter column share_token set not null;

create unique index if not exists hubs_share_token_uidx
  on public.hubs (share_token);


-- ============================================================
-- 0006_hub_pdl_phone.sql
-- ============================================================
-- Phone number for the local PDL (Pflege-Dienstleitung) contact per hub.

alter table public.hubs add column if not exists pdl_phone text;


-- ============================================================
-- 0007_placement_kind.sql
-- ============================================================
-- Distinguish what a PDL logged on the share link: placed flyers vs. delivered
-- case-management boxes. Existing rows are flyer placements.

alter table public.delivery_placements
  add column if not exists kind text not null default 'flyer';

alter table public.delivery_placements
  add constraint delivery_placements_kind_chk
  check (kind in ('flyer', 'box'));


-- ============================================================
-- 0008_open_access.sql
-- ============================================================
-- Open-access mode: the app no longer requires login. Every visitor acts as
-- the admin. Disable RLS so the public anon key can read/write, and attribute
-- new activities to the admin user (client inserts omit user_id).

alter table public.hubs                disable row level security;
alter table public.profiles            disable row level security;
alter table public.user_hubs           disable row level security;
alter table public.material_types      disable row level security;
alter table public.standorte           disable row level security;
alter table public.activities          disable row level security;
alter table public.deliveries          disable row level security;
alter table public.delivery_placements disable row level security;

-- auth.uid() is null without a session; default new activities to the admin.
alter table public.activities
  alter column user_id set default '25fe44d1-42e8-4525-9509-88860e1594fe';


-- ============================================================
-- 0009_delivery_aufsteller.sql
-- ============================================================
-- Third delivery-material category: Flyeraufsteller (flyer display stands).

alter table public.deliveries
  add column if not exists aufsteller_count integer not null default 0;


-- ============================================================
-- 0010_email_orders.sql
-- ============================================================
-- Material orders recognised from linked e-mail accounts (Gmail via OAuth),
-- plus the stored OAuth token per connected mailbox.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid references public.hubs (id) on delete set null,
  hub_input     text,                        -- raw hub text as recognised
  material      text not null,               -- e.g. "Poster", "Flyer", "Aufsteller"
  quantity      integer,
  status        text not null default 'neu' check (status in ('neu', 'erledigt')),
  source        text not null default 'email',
  email_from    text,
  email_subject text,
  received_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists orders_hub_idx on public.orders (hub_id);
create index if not exists orders_status_idx on public.orders (status);
alter table public.orders disable row level security;

create table if not exists public.email_accounts (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'google',
  email          text,
  refresh_token  text,
  access_token   text,
  token_expiry   timestamptz,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);
-- one connected mailbox per provider
create unique index if not exists email_accounts_provider_uidx
  on public.email_accounts (provider);
alter table public.email_accounts disable row level security;


-- ============================================================
-- 0011_pdl_orders.sql
-- ============================================================
-- PDL self-service + admin material orders on top of the existing `orders`
-- table (0010, originally email-only). New sources: 'pdl' (via the hub share
-- link) and 'admin' (created in-app). Adds a third workflow status and a note.

-- Third workflow state between 'neu' (offen) and 'erledigt'.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('neu', 'in_bearbeitung', 'erledigt'));

-- Optional free-text note from the ordering PDL / admin.
alter table public.orders add column if not exists note text;

-- Track staff edits (status changes). Reuses the shared set_updated_at() trigger.
alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index if not exists orders_source_idx on public.orders (source);
create index if not exists orders_created_idx on public.orders (created_at desc);


-- ============================================================
-- 0012_hub_address.sql
-- ============================================================
-- Optionale Postanschrift je Hub (für Versand von Materialbestellungen).
alter table public.hubs add column if not exists address text;


-- ============================================================
-- 0013_shop_patients.sql
-- ============================================================
-- PDL-Online-Shop (Material-Katalog + Warenkorb-Positionen) und
-- monatliche Patienten-Verifizierung (Batches + Records).
-- Alle Tabellen: RLS DISABLED — Zugriff ausschliesslich ueber den
-- Service-Role-Client (createAdminClient), wie bei `orders` (0010).

-- ============================================================
-- (A) Shop: Material-Katalog
-- ============================================================

-- Bestellbare Materialien. `key` ist stabil und kompatibel mit den
-- bestehenden Werten in orders.material ('box', 'flyer', 'aufsteller').
create table if not exists public.material_catalog (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  category    text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);
alter table public.material_catalog disable row level security;

-- Seed (idempotent): Keys MUESSEN 'box', 'flyer', 'aufsteller' bleiben.
insert into public.material_catalog (key, name, description, category, sort_order) values
  ('box', 'Case-Management-Box', 'Box mit Info-Material fuer das Case Management, wird an Praxen und Einrichtungen geliefert.', 'material', 1),
  ('flyer', 'Flyer', 'Werbe-Flyer zur Auslage bei Aerzten, Apotheken und weiteren Standorten.', 'material', 2),
  ('aufsteller', 'Flyer-Aufsteller (Plexiglas)', 'Plexiglas-Aufsteller zur Praesentation der Flyer auf Theken und Tresen.', 'material', 3)
on conflict (key) do nothing;

-- ============================================================
-- (A) Shop: Bestell-Positionen (Warenkorb)
-- ============================================================

-- Positionen einer Warenkorb-Bestellung. Der Bestellkopf bleibt `orders`;
-- Warenkorb-Bestellungen haben orders.material = null und stattdessen
-- eine oder mehrere order_items.
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  material_key text not null,
  quantity     int not null check (quantity > 0),
  created_at   timestamptz default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
alter table public.order_items disable row level security;

-- Warenkorb-Bestellungen haben material = null (Positionen in order_items).
alter table public.orders alter column material drop not null;

-- ============================================================
-- (C) Monatliche Patienten-Verifizierung
-- ============================================================

-- DSGVO — Datenminimierung: Es werden nur ein Anzeigename und eine
-- optionale Referenz-ID gespeichert, keine weiteren Patientendaten.

-- Ein Batch = eine Patientenliste pro Hub und Monat (period 'JJJJ-MM').
create table if not exists public.patient_batches (
  id         uuid primary key default gen_random_uuid(),
  hub_id     uuid not null references public.hubs (id) on delete cascade,
  period     text not null check (period ~ '^\d{4}-\d{2}$'),
  note       text,
  created_at timestamptz default now(),
  unique (hub_id, period)
);
alter table public.patient_batches disable row level security;

-- Einzelne Patienten-Eintraege eines Batches; Status wird von der PDL
-- bei der monatlichen Verifizierung gesetzt.
create table if not exists public.patient_records (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.patient_batches (id) on delete cascade,
  hub_id       uuid not null references public.hubs (id) on delete cascade,
  display_name text not null,
  reference_id text,
  status       text not null default 'offen' check (status in ('offen', 'bestaetigt', 'nicht_da')),
  note         text,
  verified_at  timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists patient_records_batch_idx on public.patient_records (batch_id);
create index if not exists patient_records_hub_idx on public.patient_records (hub_id);
alter table public.patient_records disable row level security;

-- Reuses the shared set_updated_at() trigger from 0001.
drop trigger if exists patient_records_set_updated_at on public.patient_records;
create trigger patient_records_set_updated_at
  before update on public.patient_records
  for each row execute function public.set_updated_at();


-- ============================================================
-- seed.sql
-- ============================================================
-- Marketing-Engine – seed data
-- Run after the migrations (Supabase SQL editor or `supabase db reset` picks it up).

-- Material catalog (extend anytime; no code change needed)
insert into public.material_types (name, sort_order) values
  ('Flyer', 10),
  ('Aufsteller', 20)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- Hubs (name + responsible MD). Extend/adjust as needed.
-- ------------------------------------------------------------
insert into public.hubs (name, responsible_md) values
  ('Dorsten',                 'Ben Etzrodt'),
  ('Alverdissen',             'Ben Etzrodt'),
  ('Bad Oeynhausen',          'Ben Etzrodt'),
  ('Rinteln',                 'Ben Etzrodt'),
  ('Hessisch-Oldendorf',      'Ben Etzrodt'),
  ('Bad Nenndorf',            'Ben Etzrodt'),
  ('Hameln',                  'Ben Etzrodt'),
  ('Bad Pyrmont',             'Ben Etzrodt'),
  ('Tagespflege Dorsten',     'Ben Etzrodt'),
  ('Alltagshilfe Dorsten',    'Heiko Matamaru'),
  ('Alltagshilfe Duisburg',   'Heiko Matamaru'),
  ('Alltagshilfe Düsseldorf', 'Heiko Matamaru'),
  ('Alltagshilfe Neuenrade',  'Heiko Matamaru'),
  ('Alltagshilfe Iserlohn',   'Heiko Matamaru'),
  ('Düsseldorf',              'Marcel Müller'),
  ('Kerpen',                  'Marcel Müller'),
  ('Velbert',                 'Melanie Martens'),
  ('Gevelsberg',              'Melanie Martens'),
  ('Alveo Care',              'Rachid Sabi'),
  ('Duisburg',                'Sebastian Fliegel'),
  ('Iserlohn',                'Sebastian Fliegel'),
  ('Neuenrade',               'Sebastian Fliegel'),
  ('Attendorn',               'Sebastian Fliegel'),
  ('Tagespflgege Duisburg',   'Sebastian Fliegel')
on conflict (name) do update set responsible_md = excluded.responsible_md;

-- ------------------------------------------------------------
-- Promote yourself to admin after your first login, e.g.:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ------------------------------------------------------------
