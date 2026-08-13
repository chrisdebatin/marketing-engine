-- 0055: Zeitstempel der ersten Bearbeitung (Übernehmen/Status/Ergebnis) —
-- Grundlage für die Admin-Auswertung "wie lange lag der Lead im System,
-- bevor ihn jemand angefasst hat". Wird von der Team-API beim ersten
-- Eingriff gesetzt; Altbestand bleibt null (dort unbekannt).
-- Außerdem: ergebnis-Feld auch an meta_leads (Verloren-Grund, analog 0053).
alter table public.lead_calls
  add column if not exists erstbearbeitet_at timestamptz;
alter table public.meta_leads
  add column if not exists erstbearbeitet_at timestamptz,
  add column if not exists ergebnis text;

notify pgrst, 'reload schema';
