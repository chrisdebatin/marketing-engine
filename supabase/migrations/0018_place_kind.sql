-- Orts-Kategorie für Auslage-/Liefer-Orte: Die PDL gibt beim Eintragen an,
-- WAS der Ort ist (Krankenhaus, Arztpraxis, Apotheke, Pflegeeinrichtung,
-- Sanitätshaus, Sonstiges). Altbestand bleibt null (= Sonstiges).
alter table public.delivery_placements
  add column if not exists place_kind text;
