-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Combines migrations 0006 + 0007 + 0008 + 0009 + 0010. Safe to re-run.

-- ── 0006: PDL phone number per hub ─────────────────────────────
alter table public.hubs add column if not exists pdl_phone text;

-- ── 0007: flyer vs. delivered case-management box on the PDL link ──
alter table public.delivery_placements
  add column if not exists kind text not null default 'flyer';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'delivery_placements_kind_chk'
  ) then
    alter table public.delivery_placements
      add constraint delivery_placements_kind_chk
      check (kind in ('flyer', 'box'));
  end if;
end $$;

-- ── 0008: open access (no login) ───────────────────────────────
-- Disable RLS so the public anon key can read/write; attribute new
-- activities to the admin (client inserts omit user_id).
alter table public.hubs                disable row level security;
alter table public.profiles            disable row level security;
alter table public.user_hubs           disable row level security;
alter table public.material_types      disable row level security;
alter table public.standorte           disable row level security;
alter table public.activities          disable row level security;
alter table public.deliveries          disable row level security;
alter table public.delivery_placements disable row level security;

alter table public.activities
  alter column user_id set default '25fe44d1-42e8-4525-9509-88860e1594fe';

-- ── 0009: Flyeraufsteller as a third delivery-material category ──
alter table public.deliveries
  add column if not exists aufsteller_count integer not null default 0;

-- ── 0010: e-mail-recognised material orders + connected mailbox ──
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  hub_id        uuid references public.hubs (id) on delete set null,
  hub_input     text,
  material      text not null,
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
create unique index if not exists email_accounts_provider_uidx
  on public.email_accounts (provider);
alter table public.email_accounts disable row level security;
