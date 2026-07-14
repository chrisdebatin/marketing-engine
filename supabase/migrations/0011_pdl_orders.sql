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
