-- 0029: CRM wie ein richtiges CRM —
-- a) crm_targets.plan: was an diesem Ort geliefert/gemacht werden soll
--    (To-do-Anzeige für die PDL; zentral vorgebbar).
-- b) Kontakt-Art "flyer" zusätzlich erlauben (Flyer ausgelegt), damit
--    Freitext-/KI-Logs und das vereinte Log auch Flyer-Aktionen führen.
alter table public.crm_targets add column if not exists plan text
  check (plan in ('box', 'flyer', 'besuch', 'anruf'));

alter table public.crm_contacts drop constraint if exists crm_contacts_kontakt_art_check;
alter table public.crm_contacts add constraint crm_contacts_kontakt_art_check
  check (kontakt_art in ('box', 'flyer', 'besuch', 'anruf'));

notify pgrst, 'reload schema';
