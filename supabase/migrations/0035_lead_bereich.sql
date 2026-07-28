-- 0035: Interessenten-Bereich (alltagshilfe/ambulant/intensiv) und
-- Quelle-Detail (z. B. welches Krankenhaus/Case Management) am Lead.
alter table public.lead_calls add column if not exists bereich text;
alter table public.lead_calls add column if not exists quelle_detail text;

notify pgrst, 'reload schema';
