-- 0047: Meta-Leads (Instant-Formular-Kontakte) — werden beim Aufruf von
-- /meta-ads automatisch von Meta synchronisiert. id = Metas Lead-ID, damit
-- der Sync idempotent ist. Status bleibt beim Re-Sync erhalten; Leads
-- überleben so auch Metas 90-Tage-Löschfrist.
create table if not exists public.meta_leads (
  id            text primary key,
  form_id       text,
  campaign_name text,
  ad_name       text,
  created_time  timestamptz,
  field_data    jsonb,
  status        text not null default 'offen' check (status in ('offen', 'kontaktiert')),
  created_at    timestamptz default now()
);
create index if not exists meta_leads_status_idx on public.meta_leads (status, created_time desc);
alter table public.meta_leads disable row level security;

notify pgrst, 'reload schema';
