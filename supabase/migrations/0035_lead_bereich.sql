-- 0035: Bereich (alltagshilfe/ambulant/intensiv), Quelle-Detail (welches
-- Krankenhaus/Case Management) und Name des Interessenten am Lead.
alter table public.lead_calls add column if not exists bereich text;
alter table public.lead_calls add column if not exists quelle_detail text;
alter table public.lead_calls add column if not exists lead_name text;

notify pgrst, 'reload schema';
