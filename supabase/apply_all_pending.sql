-- Ausstehende DB-Änderungen (idempotent). In den Supabase SQL-Editor
-- einfügen und ausführen:
-- https://supabase.com/dashboard/project/xbzcplpaalccjiyjhypr/sql/new
--
-- Stand: offen sind 0030–0033 — alles davor ist eingespielt.
-- (Bereits eingespielte Blöcke werden dank "if not exists" einfach übersprungen.)

-- ── 0030: Relevanz-Kategorie (1–3) für CRM-Ziel-Orte ────────────────
alter table public.crm_targets add column if not exists relevanz smallint
  check (relevanz between 1 and 3);

-- Importierte Orte tragen "Relevanz X" in der note — in die Spalte übernehmen.
update public.crm_targets
  set relevanz = (substring(note from 'Relevanz ([1-3])'))::smallint
  where relevanz is null and note ~ 'Relevanz [1-3]';

notify pgrst, 'reload schema';
select count(*) as targets_mit_relevanz from public.crm_targets where relevanz is not null;

-- ── 0031: App-Einstellungen (Follow-up-Rhythmus je Kontakt-Art) ─────
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings disable row level security;

notify pgrst, 'reload schema';

-- ── 0032: Anruf-Daten aus der Telefonanlage (CSV-Upload) ────────────
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

-- ── 0033: Wöchentliche Kapazitäts-Meldung je Hub ────────────────────
create table if not exists public.capacity_reports (
  id                uuid primary key default gen_random_uuid(),
  hub_id            uuid not null references public.hubs (id) on delete cascade,
  week_start        date not null,
  freie_plaetze     integer not null default 0 check (freie_plaetze between 0 and 99),
  beatmung_plaetze  integer not null default 0 check (beatmung_plaetze between 0 and 99),
  wg_plaetze        integer not null default 0 check (wg_plaetze between 0 and 99),
  kinder_moeglich   boolean not null default false,
  aufnahme_ab       date,
  notiz             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (hub_id, week_start)
);
alter table public.capacity_reports disable row level security;

notify pgrst, 'reload schema';

-- ── 0034: Frontoffice — Lead-Calls (Quelle + weitergeleiteter Standort) ─
create table if not exists public.lead_calls (
  id          uuid primary key default gen_random_uuid(),
  call_date   date not null default current_date,
  quelle      text not null,
  bereich     text,
  quelle_detail text,
  lead_name   text,
  hub_id      uuid references public.hubs (id) on delete set null,

  
  notiz       text,
  created_at  timestamptz default now()
);
create index if not exists lead_calls_date_idx on public.lead_calls (call_date desc);
alter table public.lead_calls disable row level security;

notify pgrst, 'reload schema';

-- ── 0035: Bereich, Quelle-Detail und Lead-Name für Lead-Calls ───────
alter table public.lead_calls add column if not exists bereich text;
alter table public.lead_calls add column if not exists quelle_detail text;
alter table public.lead_calls add column if not exists lead_name text;

notify pgrst, 'reload schema';

-- ── 0036: Meta-Ads-Kampagnen (allgemein + lokal je Hub) ─────────────
create table if not exists public.meta_ads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  typ         text not null check (typ in ('allgemein', 'lokal')),
  hub_id      uuid references public.hubs (id) on delete cascade,
  start_date  date not null default current_date,
  end_date    date,
  budget      text,
  ziel        text,
  link        text,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.meta_ads disable row level security;

notify pgrst, 'reload schema';

-- ── 0037: Personal-Anzeigen (Recruiting) je Hub ─────────────────────
create table if not exists public.personal_ads (
  id          uuid primary key default gen_random_uuid(),
  titel       text not null,
  plattform   text not null,
  hub_id      uuid references public.hubs (id) on delete cascade,
  start_date  date not null default current_date,
  end_date    date,
  link        text,
  notiz       text,
  created_at  timestamptz default now()
);
alter table public.personal_ads disable row level security;

notify pgrst, 'reload schema';

-- ── 0038: To-do-Status für das Kampagnen-Kanban ─────────────────────
alter table public.hub_notes add column if not exists status text;

notify pgrst, 'reload schema';

-- ── 0039: Kategorie-Tag für Anfragen-To-dos ─────────────────────────
alter table public.hub_notes add column if not exists tag text;

notify pgrst, 'reload schema';

-- ── 0040: Screenshots/Bilder an Anfragen-To-dos ─────────────────────
alter table public.hub_notes add column if not exists images jsonb;

notify pgrst, 'reload schema';

-- ── 0041: CRM-Ausbau Call-Center (Ansprechpartner, Geo-Tags, Leads) ─
create table if not exists public.crm_persons (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.crm_targets (id) on delete cascade,
  name       text not null,
  funktion   text,
  telefon    text,
  email      text,
  notiz      text,
  created_at timestamptz default now()
);
create index if not exists crm_persons_target_idx on public.crm_persons (target_id);
alter table public.crm_persons disable row level security;

alter table public.crm_targets add column if not exists geo_tag text;

alter table public.lead_calls
  add column if not exists target_id uuid references public.crm_targets (id) on delete set null;

alter table public.crm_contacts drop constraint if exists crm_contacts_kontakt_art_check;
alter table public.crm_contacts add constraint crm_contacts_kontakt_art_check
  check (kontakt_art in ('box', 'flyer', 'besuch', 'anruf', 'lead'));

notify pgrst, 'reload schema';

-- ── 0042: KI-To-dos aus Call-Center-Notizen ────────────────────────

create table if not exists public.crm_todos (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid not null references public.crm_targets (id) on delete cascade,
  hub_id      uuid references public.hubs (id) on delete set null,
  contact_id  uuid references public.crm_contacts (id) on delete set null,
  art         text not null default 'besuch'
    check (art in ('besuch', 'box', 'flyer', 'anruf', 'sonstiges')),
  aufgabe     text not null,
  besprochen  text,
  status      text not null default 'offen' check (status in ('offen', 'erledigt')),
  created_at  timestamptz default now(),
  done_at     timestamptz
);
create index if not exists crm_todos_hub_status_idx on public.crm_todos (hub_id, status);
create index if not exists crm_todos_contact_idx on public.crm_todos (contact_id);
alter table public.crm_todos disable row level security;

notify pgrst, 'reload schema';

-- ── 0043: Kapazitäts-Skala 1–5 (Pflege / Alltagshilfe / Wundversorgung) ─

alter table public.capacity_reports add column if not exists pflege_score smallint
  check (pflege_score between 1 and 5);
alter table public.capacity_reports add column if not exists alltagshilfe_score smallint
  check (alltagshilfe_score between 1 and 5);
alter table public.capacity_reports add column if not exists wundversorgung_score smallint
  check (wundversorgung_score between 1 and 5);

notify pgrst, 'reload schema';

-- ── 0044: Notiz-Feld an Kampagnen-Anfragen ─────────────────────────
alter table public.hub_notes add column if not exists notiz text;

notify pgrst, 'reload schema';

-- ── 0045: Werbemittel-Katalog für den Meta-Ads-KI-Agenten ──────────
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

-- ── 0046: Video-Creatives (Meta-Video-ID für Retries) ──────────────
alter table public.meta_creatives add column if not exists meta_video_id text;

notify pgrst, 'reload schema';

-- ── 0047: Meta-Leads (Instant-Formular-Kontakte, Sync von Meta) ────
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

-- ===== 0048_meta_lead_followup.sql =====
-- 0048: E-Mail-Follow-up je Meta-Lead. Beim Sync wird für neue Leads mit
-- E-Mail-Adresse automatisch ein personalisierter Entwurf erzeugt (Status
-- 'entwurf'); Versand erst nach 1-Klick-Freigabe in der Lead-Liste.
alter table public.meta_leads
  add column if not exists followup_subject text,
  add column if not exists followup_body    text,
  add column if not exists followup_status  text
    check (followup_status in ('entwurf', 'gesendet', 'fehlgeschlagen', 'verworfen')),
  add column if not exists followup_sent_at timestamptz,
  add column if not exists followup_error   text;

notify pgrst, 'reload schema';

-- ===== 0049_meta_lead_forward.sql =====
-- 0049: Automatische Weiterleitung von Mitarbeiter-Leads an das Recruiting-
-- Postfach (LEAD_FORWARD_TO, Default recruiting@igsg.de). Der Sync
-- verschickt je Lead genau eine Mail; forwarded_at macht das idempotent.
alter table public.meta_leads
  add column if not exists forwarded_at  timestamptz,
  add column if not exists forward_error text;

notify pgrst, 'reload schema';

-- ===== 0050_meta_lead_crm.sql =====
-- 0050: Meta-Leads erscheinen zusätzlich im CRM (crm_targets) — als eigene
-- Kategorien meta_mitarbeiter / meta_kunde, getrennt von den Krankenhäusern.
-- crm_target_id verknüpft Lead ↔ CRM-Eintrag und macht den Sync idempotent.
alter table public.meta_leads
  add column if not exists crm_target_id uuid references public.crm_targets(id) on delete set null;

notify pgrst, 'reload schema';

-- ── 0051: Leads löschbar (Soft-Delete, Sync legt sie nicht neu an) ─
alter table public.meta_leads drop constraint if exists meta_leads_status_check;
alter table public.meta_leads add constraint meta_leads_status_check
  check (status in ('offen', 'kontaktiert', 'geloescht'));

notify pgrst, 'reload schema';

-- ── 0052: Persönliche Team-Links (Davina/Belinda/Adelina) + Claim/Status ─
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  team       text not null check (team in ('kundenservice', 'callcenter')),
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  active     boolean not null default true,
  created_at timestamptz default now()
);
alter table public.team_members disable row level security;

insert into public.team_members (name, team)
select v.name, v.team
from (values
  ('Belinda', 'kundenservice'),
  ('Adelina', 'kundenservice'),
  ('Davina',  'callcenter')
) as v(name, team)
where not exists (select 1 from public.team_members m where m.name = v.name);

alter table public.lead_calls add column if not exists bearbeiter text;
alter table public.lead_calls add column if not exists status text not null default 'offen'
  check (status in ('offen', 'kontaktiert', 'erstgespraech', 'aufgenommen', 'verloren'));
alter table public.lead_calls add column if not exists telefon text;
alter table public.lead_calls add column if not exists email text;

alter table public.meta_leads add column if not exists bearbeiter text;
alter table public.meta_leads drop constraint if exists meta_leads_status_check;
alter table public.meta_leads add constraint meta_leads_status_check
  check (status in ('offen', 'kontaktiert', 'erstgespraech', 'aufgenommen', 'verloren', 'geloescht'));

alter table public.crm_contacts add column if not exists bearbeiter text;

notify pgrst, 'reload schema';
select name, team, token from public.team_members order by team, name;

-- ── 0053: Ergebnis-Feld an Leads (Recare: aufgenommen / keine Kapazität / …) ─
alter table public.lead_calls add column if not exists ergebnis text;

notify pgrst, 'reload schema';
