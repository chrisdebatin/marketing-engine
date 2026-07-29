-- 0039: Kategorie-Tag für Anfragen-To-dos (Meta-Anzeige, Zeitungsanzeige, …).
alter table public.hub_notes add column if not exists tag text;

notify pgrst, 'reload schema';
