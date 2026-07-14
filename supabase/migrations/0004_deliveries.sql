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
