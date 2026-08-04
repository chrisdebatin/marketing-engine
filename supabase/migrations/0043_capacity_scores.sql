-- 0043: Kapazitäts-Skala je Leistungsbereich —
-- Pflege, Alltagshilfe und Wundversorgung werden je Standort auf einer
-- Skala 1–5 gemeldet (5 = volle Kapazität/grün, 1 = keine Kapazität/rot).
-- Ergänzt die bestehenden Platz-Zahlen, ersetzt sie nicht.

alter table public.capacity_reports add column if not exists pflege_score smallint
  check (pflege_score between 1 and 5);
alter table public.capacity_reports add column if not exists alltagshilfe_score smallint
  check (alltagshilfe_score between 1 and 5);
alter table public.capacity_reports add column if not exists wundversorgung_score smallint
  check (wundversorgung_score between 1 and 5);

notify pgrst, 'reload schema';
