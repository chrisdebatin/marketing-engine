-- Standardisierte Lead-Stammdaten: Adresse/Ort als eigenes Feld an beiden
-- Lead-Tabellen (bisher steckte der Ort nur im Notiz-Freitext).
alter table public.lead_calls add column if not exists adresse text;
alter table public.meta_leads add column if not exists adresse text;

notify pgrst, 'reload schema';
