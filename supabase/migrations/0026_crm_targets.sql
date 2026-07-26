-- CRM: zentrale Liste der Ziel-Orte (Krankenhäuser, Praxen, …), die erreicht
-- werden sollen. Jeder Ziel-Ort ist einem Hub zugeteilt; die PDL sieht ihre
-- Besuchs-Liste auf dem Dashboard und hakt Besuche ab. Nach einem Besuch
-- wird der nächste Termin automatisch auf heute + intervall_wochen gesetzt.
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client.

create table if not exists public.crm_targets (
  id               uuid primary key default gen_random_uuid(),
  hub_id           uuid references public.hubs (id) on delete set null,
  name             text not null,
  kategorie        text,
  adresse          text,
  ort              text,
  note             text,
  intervall_wochen integer not null default 3 check (intervall_wochen between 1 and 52),
  letzter_besuch   date,
  naechster_besuch date,
  besuchs_notiz    text,
  created_at       timestamptz default now()
);
create index if not exists crm_targets_hub_idx on public.crm_targets (hub_id);
alter table public.crm_targets disable row level security;
