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
