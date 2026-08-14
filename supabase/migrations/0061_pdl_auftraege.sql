-- Aufträge, die das Callcenter im Anruf zugesagt hat und die eine PDL
-- vor Ort erledigen soll (z. B. "Flyer vorbeibringen", "CM-Box liefern").
-- Die KI liest sie aus der Anruf-Notiz, der Callcenter-MA bestätigt sie,
-- die PDL sieht Auftrag + Anrufprotokoll auf ihrer Standort-Seite.
create table if not exists public.pdl_auftraege (
  id uuid primary key default gen_random_uuid(),
  -- Institution, bei der angerufen wurde
  target_id uuid not null references public.crm_targets (id) on delete cascade,
  -- Standort, der den Auftrag ausführen soll
  hub_id uuid references public.hubs (id) on delete set null,
  -- Was ist zu tun (KI-Vorschlag, vom MA bestätigt/bearbeitet)
  text text not null,
  -- Kontext fürs Protokoll: wer hat wann mit wem telefoniert
  anruf_datum date not null,
  anruf_von text,
  ansprechpartner text,
  anruf_notiz text,
  status text not null default 'offen',   -- offen | erledigt | abgelehnt
  erledigt_at timestamptz,
  erledigt_von text,
  created_at timestamptz not null default now()
);

create index if not exists pdl_auftraege_hub_idx
  on public.pdl_auftraege (hub_id, status);
create index if not exists pdl_auftraege_target_idx
  on public.pdl_auftraege (target_id);

-- Zugriff läuft ausschließlich über den Service-Role-Client (Token-Seiten
-- ohne Login), daher keine RLS-Policies wie bei den übrigen CRM-Tabellen.
alter table public.pdl_auftraege disable row level security;
