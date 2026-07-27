-- 0032: Anruf-Daten aus der Telefonanlage (CSV-Upload auf /statistik).
-- Ein Datensatz je Anruf (Call ID) — Mehrfach-Uploads derselben Datei
-- werden per unique call_id ignoriert.
create table if not exists public.phone_calls (
  id               uuid primary key default gen_random_uuid(),
  call_id          text unique not null,
  call_time        timestamptz not null,
  hub_name         text,
  direction        text not null check (direction in ('inbound', 'outbound', 'internal')),
  answered         boolean not null default false,
  talking_seconds  integer not null default 0,
  created_at       timestamptz default now()
);
create index if not exists phone_calls_time_idx on public.phone_calls (call_time desc);
alter table public.phone_calls disable row level security;

notify pgrst, 'reload schema';
