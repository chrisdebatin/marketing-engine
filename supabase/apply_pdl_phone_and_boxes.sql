-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
-- Combines migrations 0006 + 0007.

-- 0006: PDL phone number per hub
alter table public.hubs add column if not exists pdl_phone text;

-- 0007: distinguish flyer placements from delivered case-management boxes
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
