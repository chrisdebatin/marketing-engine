-- Ortschaft (Stadt) für Auslage-/Liefer-Orte: Die PDL gibt zusätzlich zum
-- Einrichtungs-Namen an, in welchem Ort verteilt wurde. Altbestand: null.
alter table public.delivery_placements
  add column if not exists ort text;
