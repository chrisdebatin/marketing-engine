-- 0038: Status für To-dos (Kanban): offen (null) / in_arbeit.
alter table public.hub_notes add column if not exists status text;

notify pgrst, 'reload schema';
