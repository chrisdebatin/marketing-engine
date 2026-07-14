-- Optionale Postanschrift je Hub (für Versand von Materialbestellungen).
alter table public.hubs add column if not exists address text;
