-- Patienten-Verifizierung: Herkunft eines Eintrags.
-- 'zentral' = aus der zentralen Liste importiert (Marketing-Team),
-- 'pdl'     = von der PDL ueber den Hub-Link ergaenzt (fehlte zentral).
alter table public.patient_records
  add column if not exists source text not null default 'zentral'
  check (source in ('zentral', 'pdl'));
