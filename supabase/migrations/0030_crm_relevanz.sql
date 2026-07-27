-- 0030: Relevanz-Kategorie (1 = höchste, 3 = niedrigste) für CRM-Ziel-Orte.
-- Importierte Orte tragen die Relevanz zusätzlich in der note ("Relevanz X"),
-- solange die Spalte fehlt — der Backfill übernimmt sie in die Spalte.
alter table public.crm_targets add column if not exists relevanz smallint
  check (relevanz between 1 and 3);

update public.crm_targets
  set relevanz = (substring(note from 'Relevanz ([1-3])'))::smallint
  where relevanz is null and note ~ 'Relevanz [1-3]';

notify pgrst, 'reload schema';
