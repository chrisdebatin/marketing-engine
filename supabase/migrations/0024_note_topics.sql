-- Themen für Standort-Notizen (z. B. "Recare"): Ein Thema betrifft alle
-- Standorte, jeder Standort hat seinen eigenen Stand (Notizen je Hub+Thema).
-- RLS DISABLED — Zugriff ausschliesslich über den Service-Role-Client.

create table if not exists public.note_topics (
  id         uuid primary key default gen_random_uuid(),
  title      text not null unique,
  created_at timestamptz default now()
);
alter table public.note_topics disable row level security;

-- Notizen optional einem Thema zuordnen (null = allgemeine Notiz).
alter table public.hub_notes
  add column if not exists topic_id uuid references public.note_topics (id) on delete cascade;
create index if not exists hub_notes_topic_idx on public.hub_notes (topic_id);
