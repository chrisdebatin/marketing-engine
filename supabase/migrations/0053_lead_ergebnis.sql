-- 0053: Ergebnis-Feld an Leads — v. a. für Recare-Anfragen: "Patient
-- aufgenommen", "Keine Kapazität", "PDL nicht erreicht" oder Freitext.
alter table public.lead_calls add column if not exists ergebnis text;

notify pgrst, 'reload schema';
