-- Outlook-/Microsoft-Graph-Anbindung: gespeicherter OAuth-Refresh-Token des
-- verbundenen Kontos (eine Zeile). RLS DISABLED — Zugriff ausschliesslich
-- über den Service-Role-Client; der Token verlässt den Server nie.

create table if not exists public.ms_oauth_tokens (
  id            text primary key default 'default',
  account_email text,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);
alter table public.ms_oauth_tokens disable row level security;
