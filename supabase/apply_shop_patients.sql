-- Marketing-Engine: Shop-Katalog/order_items + Patienten-Verifizierung
-- Einmal im Supabase SQL-Editor einfuegen und ausfuehren.
-- Enthaelt Migration 0013 (material_catalog, order_items, patient_batches, patient_records).

-- ===== 0013_shop_patients.sql =====
-- PDL-Online-Shop (Material-Katalog + Warenkorb-Positionen) und
-- monatliche Patienten-Verifizierung (Batches + Records).
-- Alle Tabellen: RLS DISABLED — Zugriff ausschliesslich ueber den
-- Service-Role-Client (createAdminClient), wie bei `orders` (0010).

-- ============================================================
-- (A) Shop: Material-Katalog
-- ============================================================

-- Bestellbare Materialien. `key` ist stabil und kompatibel mit den
-- bestehenden Werten in orders.material ('box', 'flyer', 'aufsteller').
create table if not exists public.material_catalog (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  category    text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);
alter table public.material_catalog disable row level security;

-- Seed (idempotent): Keys MUESSEN 'box', 'flyer', 'aufsteller' bleiben.
insert into public.material_catalog (key, name, description, category, sort_order) values
  ('box', 'Case-Management-Box', 'Box mit Info-Material fuer das Case Management, wird an Praxen und Einrichtungen geliefert.', 'material', 1),
  ('flyer', 'Flyer', 'Werbe-Flyer zur Auslage bei Aerzten, Apotheken und weiteren Standorten.', 'material', 2),
  ('aufsteller', 'Flyer-Aufsteller (Plexiglas)', 'Plexiglas-Aufsteller zur Praesentation der Flyer auf Theken und Tresen.', 'material', 3)
on conflict (key) do nothing;

-- ============================================================
-- (A) Shop: Bestell-Positionen (Warenkorb)
-- ============================================================

-- Positionen einer Warenkorb-Bestellung. Der Bestellkopf bleibt `orders`;
-- Warenkorb-Bestellungen haben orders.material = null und stattdessen
-- eine oder mehrere order_items.
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  material_key text not null,
  quantity     int not null check (quantity > 0),
  created_at   timestamptz default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
alter table public.order_items disable row level security;

-- Warenkorb-Bestellungen haben material = null (Positionen in order_items).
alter table public.orders alter column material drop not null;

-- ============================================================
-- (C) Monatliche Patienten-Verifizierung
-- ============================================================

-- DSGVO — Datenminimierung: Es werden nur ein Anzeigename und eine
-- optionale Referenz-ID gespeichert, keine weiteren Patientendaten.

-- Ein Batch = eine Patientenliste pro Hub und Monat (period 'JJJJ-MM').
create table if not exists public.patient_batches (
  id         uuid primary key default gen_random_uuid(),
  hub_id     uuid not null references public.hubs (id) on delete cascade,
  period     text not null check (period ~ '^\d{4}-\d{2}$'),
  note       text,
  created_at timestamptz default now(),
  unique (hub_id, period)
);
alter table public.patient_batches disable row level security;

-- Einzelne Patienten-Eintraege eines Batches; Status wird von der PDL
-- bei der monatlichen Verifizierung gesetzt.
create table if not exists public.patient_records (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.patient_batches (id) on delete cascade,
  hub_id       uuid not null references public.hubs (id) on delete cascade,
  display_name text not null,
  reference_id text,
  status       text not null default 'offen' check (status in ('offen', 'bestaetigt', 'nicht_da')),
  note         text,
  verified_at  timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists patient_records_batch_idx on public.patient_records (batch_id);
create index if not exists patient_records_hub_idx on public.patient_records (hub_id);
alter table public.patient_records disable row level security;

-- Reuses the shared set_updated_at() trigger from 0001.
drop trigger if exists patient_records_set_updated_at on public.patient_records;
create trigger patient_records_set_updated_at
  before update on public.patient_records
  for each row execute function public.set_updated_at();
