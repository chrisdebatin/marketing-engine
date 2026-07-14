-- Third delivery-material category: Flyeraufsteller (flyer display stands).

alter table public.deliveries
  add column if not exists aufsteller_count integer not null default 0;
