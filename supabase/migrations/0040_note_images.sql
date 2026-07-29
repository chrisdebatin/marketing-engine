-- Screenshots/Bilder an Anfragen-To-dos (Kanban): Array öffentlicher
-- Storage-URLs. Der Bucket "note-images" wird zur Laufzeit automatisch
-- angelegt (public), daher hier nur die Spalte.
alter table public.hub_notes add column if not exists images jsonb;
