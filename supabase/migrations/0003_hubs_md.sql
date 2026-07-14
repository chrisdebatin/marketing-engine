-- Add the responsible MD (person accountable for the hub) to hubs.
alter table public.hubs
  add column if not exists responsible_md text;
