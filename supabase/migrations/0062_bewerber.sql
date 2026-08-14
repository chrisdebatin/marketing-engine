-- Bewerbungen (Meta-Anzeigen + Website), die an einen Standort weitergeleitet
-- wurden. Die PDL sieht sie unter "Meine Bewerber" und meldet zurück, was
-- daraus geworden ist. Liegezeit = zugewiesen_at → erstkontakt_at.
create table if not exists public.bewerber (
  id uuid primary key default gen_random_uuid(),
  -- Herkunft: "meta" | "website"; quelle_id verweist auf meta_leads.id bzw.
  -- lead_calls.id und macht die Weiterleitung idempotent.
  quelle text not null,
  quelle_id text not null,
  name text not null,
  telefon text,
  email text,
  rolle text,
  kampagne text,
  hub_id uuid references public.hubs (id) on delete set null,
  -- KI-Bewertung: 1 = niedrig, 2 = mittel, 3 = hoch (+ Begründung)
  score smallint check (score between 1 and 3),
  score_grund text,
  status text not null default 'neu',
    -- neu | kontaktiert | gespraech | eingestellt | abgesagt
  notiz text,
  weitergeleitet_von text,
  zugewiesen_at timestamptz not null default now(),
  -- Erste Reaktion der PDL — Grundlage der Liegezeit-Auswertung
  erstkontakt_at timestamptz,
  abgeschlossen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quelle, quelle_id)
);

create index if not exists bewerber_hub_idx on public.bewerber (hub_id, status);
create index if not exists bewerber_zugewiesen_idx
  on public.bewerber (zugewiesen_at desc);

-- Zugriff über den Service-Role-Client (Token-Seiten ohne Login).
alter table public.bewerber disable row level security;
