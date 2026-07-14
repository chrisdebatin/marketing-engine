-- Distinguish what a PDL logged on the share link: placed flyers vs. delivered
-- case-management boxes. Existing rows are flyer placements.

alter table public.delivery_placements
  add column if not exists kind text not null default 'flyer';

alter table public.delivery_placements
  add constraint delivery_placements_kind_chk
  check (kind in ('flyer', 'box'));
