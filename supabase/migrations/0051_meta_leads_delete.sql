-- 0051: Leads löschbar machen (Soft-Delete). Harte Löschung geht nicht —
-- der Meta-Sync würde den Lead beim nächsten Lauf wieder anlegen. Status
-- 'geloescht' blendet ihn dauerhaft aus; die Sync-Upsert-Logik (ignore
-- duplicates) fasst bestehende Zeilen nicht an.
alter table public.meta_leads drop constraint if exists meta_leads_status_check;
alter table public.meta_leads add constraint meta_leads_status_check
  check (status in ('offen', 'kontaktiert', 'geloescht'));

notify pgrst, 'reload schema';
