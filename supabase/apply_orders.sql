-- Marketing-Engine: Bestell-System (PDL + Admin Materialbestellungen)
-- Einmal im Supabase SQL-Editor einfuegen und ausfuehren.
-- Enthaelt Migration 0010 (orders/email_accounts) + 0011 (PDL-Bestellungen).

-- ===== 0010_email_orders.sql =====
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


-- ===== 0011_pdl_orders.sql =====
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
