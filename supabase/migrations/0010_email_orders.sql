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
