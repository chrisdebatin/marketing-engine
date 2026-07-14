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
