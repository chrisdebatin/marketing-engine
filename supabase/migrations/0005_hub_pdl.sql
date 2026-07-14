-- Local PDL (Pflege-Dienstleitung) contact per hub + a stable share token for
-- the per-hub PDL link.

alter table public.hubs add column if not exists pdl_name  text;
alter table public.hubs add column if not exists pdl_email text;
alter table public.hubs add column if not exists share_token text;

-- backfill tokens for existing hubs
update public.hubs
  set share_token = replace(gen_random_uuid()::text, '-', '')
  where share_token is null;

alter table public.hubs
  alter column share_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.hubs
  alter column share_token set not null;

create unique index if not exists hubs_share_token_uidx
  on public.hubs (share_token);
