-- Phone number for the local PDL (Pflege-Dienstleitung) contact per hub.

alter table public.hubs add column if not exists pdl_phone text;
