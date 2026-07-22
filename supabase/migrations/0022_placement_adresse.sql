-- Adresse (Straße + Hausnr.) für Auslage-/Liefer-Orte: "Empfang" allein
-- reicht nicht — die PDL gibt zusätzlich eine Adresse an. Altbestand: null.
alter table public.delivery_placements
  add column if not exists adresse text;
