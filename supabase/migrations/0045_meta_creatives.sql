-- 0045: Hochgeladene Werbemittel (Bilder) für den Meta-Ads-KI-Agenten.
-- Dateien liegen im öffentlichen Storage-Bucket "meta-creatives"; diese
-- Tabelle ist der Katalog, aus dem der Agent beim Anzeigen-Erstellen wählt.
create table if not exists public.meta_creatives (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  path        text not null,
  url         text not null,
  mime        text not null,
  size_bytes  bigint not null default 0,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.meta_creatives disable row level security;

notify pgrst, 'reload schema';
