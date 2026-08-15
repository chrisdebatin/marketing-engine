-- ==============================================================
-- Mitarbeiter-App: 0063 + 0064 in EINEM Rutsch.
-- Im Supabase-SQL-Editor einfuegen und ausfuehren.
--
-- DANACH ZWINGEND (einmalig):
--   Settings -> Data API -> Exposed schemas -> "employee_app" ergaenzen
-- Ohne diesen Schritt antwortet PostgREST mit 406/PGRST106 —
-- auch fuer den Service-Role-Key.
-- ==============================================================

-- Mitarbeiter-App (Employee App) — eigenes Schema, strikt getrennt vom CRM.
--
-- ZWINGENDE VORAUSSETZUNG (einmalig, im Supabase-Dashboard):
--   Settings -> API -> Exposed schemas -> "employee_app" ergaenzen.
-- Ohne diesen Schritt antwortet PostgREST mit 406 / PGRST106 ("Invalid schema")
-- — und zwar AUCH fuer den Service-Role-Client. Die App startet dann nicht.
--
-- Warum ein eigenes Schema statt Tabellen in public:
--   public traegt die Supabase-Standard-Grants fuer anon/authenticated. Genau
--   diese Grants (zusammen mit 0008_open_access) machen die CRM-Tabellen heute
--   mit dem oeffentlichen anon-Key les- UND schreibbar. Ein frisches Schema hat
--   diese Grants nicht. Zusaetzlich sorgt "alter default privileges" in
--   0064 dafuer, dass auch KUENFTIGE Tabellen hier von Haus aus gesperrt sind.
--
-- Zugriff erfolgt ausschliesslich serverseitig ueber den Service-Role-Client
-- (BYPASSRLS). Die Autorisierung passiert im Route-Handler, nicht in der DB:
-- staff_id kommt IMMER aus der Session, niemals aus dem Request.
--
-- REGEL: Niemals eine View oder SECURITY-DEFINER-Funktion in public anlegen,
-- die employee_app liest — Views laufen mit den Rechten des Owners und wuerden
-- die Sperren aus 0064 aushebeln.

create schema if not exists employee_app;

-- ============================================================
-- Mitarbeiter (~650). Hubs werden aus public.hubs wiederverwendet,
-- NICHT dupliziert (public.hubs traegt bereits name/region/adresse).
-- ============================================================
create table if not exists employee_app.staff (
  id          uuid primary key default gen_random_uuid(),
  hub_id      uuid references public.hubs (id) on delete set null,
  vorname     text not null,
  nachname    text not null,
  -- Personalnummer aus der zentralen Mitarbeiterliste (Import-Schluessel).
  personalnr  text,
  rolle       text not null default 'mitarbeiter'
              check (rolle in ('mitarbeiter', 'hubleiter', 'admin')),
  status      text not null default 'eingeladen'
              check (status in ('eingeladen', 'aktiv', 'gesperrt', 'ausgeschieden')),
  -- Optionale Bruecke zum Marketing-Engine-Login (selten: jemand nutzt beides).
  profile_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists staff_personalnr_uidx
  on employee_app.staff (lower(personalnr)) where personalnr is not null;
create unique index if not exists staff_profile_uidx
  on employee_app.staff (profile_id) where profile_id is not null;
create index if not exists staff_hub_idx
  on employee_app.staff (hub_id, status);
create index if not exists staff_name_idx
  on employee_app.staff (lower(nachname), lower(vorname));

-- ============================================================
-- Aktivierungscodes — Einmal-Onboarding ueber die Hubleitung.
-- Klartext wird NIE gespeichert: code_hash = HMAC-SHA256(pepper, code).
-- HMAC statt bcrypt, weil der Code mit ~49,6 Bit Entropie ohnehin nicht
-- ratbar ist und wir ihn per Index nachschlagen koennen muessen.
-- ============================================================
create table if not exists employee_app.activation_codes (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references employee_app.staff (id) on delete cascade,
  code_hash   text not null,
  -- Letzte 2 Zeichen im Klartext — nur damit der Admin am Telefon abgleichen kann.
  code_hint   text,
  expires_at  timestamptz not null default (now() + interval '30 days'),
  used_at     timestamptz,
  created_by  text,
  created_at  timestamptz not null default now()
);

create unique index if not exists activation_codes_hash_uidx
  on employee_app.activation_codes (code_hash);
-- Hoechstens EIN offener Code pro Mitarbeiter (verhindert Code-Wildwuchs).
create unique index if not exists activation_codes_open_uidx
  on employee_app.activation_codes (staff_id) where used_at is null;

-- ============================================================
-- Geraete — der eigentliche Authentifizierungsfaktor.
-- Die 6-stellige PIN allein waere mit ~10^4 effektiver Entropie zu schwach.
-- Deshalb: Aktivierung bindet ein Geraet (device_secret, 32 zufaellige Bytes,
-- nur als SHA-256 gespeichert). Die PIN entsperrt NUR dieses Geraet.
-- Es gibt bewusst keinen Endpunkt, der (Mitarbeiter-Kennung + PIN) akzeptiert.
-- ============================================================
create table if not exists employee_app.devices (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references employee_app.staff (id) on delete cascade,
  secret_hash    text not null,
  label          text,
  -- PIN-Hash: scrypt (node:crypto), per-Geraet zufaelliges Salt.
  pin_hash       text,
  pin_set_at     timestamptz,
  -- Fehlversuche SEIT der letzten Sperre (wird beim Sperren zurueckgesetzt).
  failed_count   smallint not null default 0 check (failed_count >= 0),
  -- Anzahl bisheriger Sperren — daraus ergibt sich die Sperrdauer.
  -- Bewusst getrennt von failed_count: sonst wuerde nach der ersten Sperre
  -- jeder EINZELNE weitere Fehlversuch sofort neu sperren, ohne dass die
  -- Dauer sinnvoll ansteigt.
  lock_count     smallint not null default 0 check (lock_count >= 0),
  locked_until   timestamptz,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text
);

create unique index if not exists devices_secret_uidx
  on employee_app.devices (secret_hash);
create index if not exists devices_staff_idx
  on employee_app.devices (staff_id, last_seen_at desc) where revoked_at is null;

-- ============================================================
-- Sessions — opakes Token, nur als SHA-256 gespeichert.
-- Cookie traegt den Klartext; ein DB-Dump enthaelt keine nutzbaren Tokens.
-- ============================================================
create table if not exists employee_app.sessions (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references employee_app.staff (id) on delete cascade,
  device_id      uuid not null references employee_app.devices (id) on delete cascade,
  token_hash     text not null,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '30 days'),
  revoked_at     timestamptz,
  revoked_reason text
);

create unique index if not exists sessions_token_uidx
  on employee_app.sessions (token_hash);
create index if not exists sessions_staff_idx
  on employee_app.sessions (staff_id, last_seen_at desc) where revoked_at is null;
create index if not exists sessions_expiry_idx
  on employee_app.sessions (expires_at) where revoked_at is null;

-- ============================================================
-- Login-Versuche — Brute-Force-Bremse.
-- Bewusst in der DB (nicht in-memory): Vercel laeuft multi-instance,
-- ein Modul-Level-Map waere pro Instanz separat und beim Cold Start weg.
-- ============================================================
create table if not exists employee_app.auth_attempts (
  id         bigint generated always as identity primary key,
  -- 'device:<uuid>' | 'ip:<hmac>' | 'activation_ip:<hmac>'
  bucket     text not null,
  kind       text not null check (kind in ('pin', 'activation')),
  ok         boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_bucket_idx
  on employee_app.auth_attempts (bucket, kind, created_at desc);

-- ============================================================
-- Ankündigungen. V1: unternehmensweit. Targeting-Spalten existieren bereits,
-- damit spaeter kein Backfill noetig ist (hub/region lesen public.hubs).
-- ============================================================
create table if not exists employee_app.announcements (
  id             uuid primary key default gen_random_uuid(),
  titel          text not null,
  body           text not null,
  image_url      text,
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'archived')),
  prioritaet     text not null default 'normal'
                 check (prioritaet in ('normal', 'wichtig')),
  publish_at     timestamptz not null default now(),
  target_scope   text not null default 'all'
                 check (target_scope in ('all', 'hub', 'region', 'rolle')),
  target_hub_ids uuid[] not null default '{}',
  target_regions text[] not null default '{}',
  target_rollen  text[] not null default '{}',
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint announcements_target_chk check (
    case target_scope
      when 'all'    then cardinality(target_hub_ids) = 0
                     and cardinality(target_regions) = 0
                     and cardinality(target_rollen) = 0
      when 'hub'    then cardinality(target_hub_ids) > 0
      when 'region' then cardinality(target_regions) > 0
      when 'rolle'  then cardinality(target_rollen) > 0
    end
  )
);

-- Feed-Query: status='published' and publish_at <= now() order by publish_at desc
create index if not exists announcements_feed_idx
  on employee_app.announcements (publish_at desc) where status = 'published';
create index if not exists announcements_admin_idx
  on employee_app.announcements (status, publish_at desc);

-- Gelesen-Markierung (Punkt an der News-Tab-Ikone).
create table if not exists employee_app.announcement_reads (
  announcement_id uuid not null
    references employee_app.announcements (id) on delete cascade,
  staff_id        uuid not null
    references employee_app.staff (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, staff_id)
);

create index if not exists announcement_reads_staff_idx
  on employee_app.announcement_reads (staff_id);

-- ============================================================
-- Kunden-Empfehlungen. hub_id ist ein SNAPSHOT des Hubs zum Zeitpunkt der
-- Einreichung — bleibt korrekt, auch wenn der Mitarbeiter spaeter wechselt.
-- ============================================================
create table if not exists employee_app.customer_referrals (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null
    references employee_app.staff (id) on delete restrict,
  hub_id        uuid references public.hubs (id) on delete set null,
  kunde_name    text not null,
  telefon       text,
  email         text,
  ort           text,
  beziehung     text,
  notiz         text,
  -- DSGVO: Der Empfohlene ist eine dritte Person. Der Mitarbeiter bestaetigt,
  -- dass die Person Bescheid weiss. Zeitpunkt + Textversion werden protokolliert.
  consent_at    timestamptz not null default now(),
  consent_version text not null default 'v1',
  status        text not null default 'submitted'
                check (status in ('submitted', 'contacted', 'qualified',
                                  'converted', 'rejected',
                                  'bonus_eligible', 'bonus_paid')),
  status_notiz  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists customer_referrals_staff_idx
  on employee_app.customer_referrals (staff_id, created_at desc);
create index if not exists customer_referrals_admin_idx
  on employee_app.customer_referrals (status, created_at desc);

-- ============================================================
-- M&A-Empfehlungen. Nur firma_name ist Pflicht — auch unvollstaendige
-- Hinweise sind wertvoll. Der Status-Lebenszyklus ist bereits vollstaendig
-- modelliert; V1 nutzt in der Admin-UI nur ein einfaches Dropdown.
-- ============================================================
create table if not exists employee_app.ma_referrals (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null
    references employee_app.staff (id) on delete restrict,
  hub_id        uuid references public.hubs (id) on delete set null,
  firma_name    text not null,
  inhaber_name  text,
  telefon       text,
  email         text,
  ort           text,
  beziehung     text,
  notiz         text,
  status        text not null default 'submitted'
                check (status in ('submitted', 'reviewing', 'contacted',
                                  'qualified', 'negotiating', 'acquired',
                                  'rejected', 'bonus_eligible', 'bonus_paid')),
  status_notiz  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ma_referrals_staff_idx
  on employee_app.ma_referrals (staff_id, created_at desc);
create index if not exists ma_referrals_admin_idx
  on employee_app.ma_referrals (status, created_at desc);
create index if not exists ma_referrals_open_idx
  on employee_app.ma_referrals (created_at desc)
  where status not in ('rejected', 'bonus_paid');

-- ============================================================
-- Audit / Security-Events (append-only).
-- DSGVO: KEINE Codes, PINs, Tokens oder Roh-IPs hier hineinschreiben.
-- IPs werden als HMAC gespeichert (siehe src/lib/employee/audit.ts).
-- ============================================================
create table if not exists employee_app.audit_events (
  id         bigint generated always as identity primary key,
  staff_id   uuid references employee_app.staff (id) on delete set null,
  art        text not null,
  ziel_art   text,
  ziel_id    uuid,
  ip_hash    text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_staff_idx
  on employee_app.audit_events (staff_id, created_at desc);
create index if not exists audit_events_art_idx
  on employee_app.audit_events (art, created_at desc);

-- ============================================================
-- updated_at-Trigger — nutzt public.set_updated_at() aus 0001_init.sql.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'announcements', 'customer_referrals', 'ma_referrals'
  ] loop
    execute format(
      'drop trigger if exists %I_set_updated_at on employee_app.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on employee_app.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ============ 0064: Zugriffsschutz ============

-- Mitarbeiter-App: Zugriffsschutz. Bewusst als eigene Migration, damit die
-- Sicherheits-Haltung isoliert reviewbar ist.
--
-- Drei unabhaengige Schichten:
--   1. RLS an, KEINE Policies  -> Default ist "deny" fuer anon/authenticated.
--   2. Grants entzogen          -> scheitert schon vor der RLS-Pruefung.
--   3. Default Privileges       -> auch KUENFTIGE Tabellen sind ab Geburt gesperrt.
--
-- Warum Schicht 2 und 3 nicht optional sind: In diesem Repo wurde RLS 38-mal
-- per "disable row level security" wieder abgeschaltet (0008 ff.). Schicht 1
-- allein wuerde also genau dem Muster zum Opfer fallen, das hier belegbar
-- vorkommt. Die entzogenen Grants ueberleben ein solches "disable".
--
-- Warum das den Service-Role-Client nicht bricht: service_role besitzt das
-- Rollen-Attribut BYPASSRLS. Postgres ueberspringt die Policy-Pruefung fuer
-- diese Rolle komplett (es wertet nicht etwa leere Policies "positiv" aus).
-- ABER: BYPASSRLS umgeht KEINE Grants. Der explizite Grant an service_role
-- weiter unten ist deshalb zwingend — ohne ihn bricht die eigene App mit
-- "permission denied for table staff".

-- ------------------------------------------------------------
-- Schicht 1: RLS aktivieren, keine Policies anlegen.
-- ------------------------------------------------------------
alter table employee_app.staff              enable row level security;
alter table employee_app.activation_codes   enable row level security;
alter table employee_app.devices            enable row level security;
alter table employee_app.sessions           enable row level security;
alter table employee_app.auth_attempts      enable row level security;
alter table employee_app.announcements      enable row level security;
alter table employee_app.announcement_reads enable row level security;
alter table employee_app.customer_referrals enable row level security;
alter table employee_app.ma_referrals       enable row level security;
alter table employee_app.audit_events       enable row level security;

-- ------------------------------------------------------------
-- Schicht 2: Der oeffentliche anon-Key (und authenticated) bekommt hier nichts.
-- Ein frisches Schema traegt die Supabase-Standard-Grants auf public nicht —
-- diese Revokes stellen das explizit sicher und dokumentieren die Absicht.
-- ------------------------------------------------------------
revoke all on schema employee_app from anon, authenticated, public;
revoke all on all tables in schema employee_app from anon, authenticated, public;
revoke all on all sequences in schema employee_app from anon, authenticated, public;
revoke all on all functions in schema employee_app from anon, authenticated, public;

-- ------------------------------------------------------------
-- Schicht 3: Kuenftige Objekte in diesem Schema sind ab Geburt gesperrt.
-- Genau das laesst sich in public NICHT nachbilden — dort erben neue Tabellen
-- die Standard-Grants fuer anon/authenticated.
-- ------------------------------------------------------------
alter default privileges in schema employee_app
  revoke all on tables from anon, authenticated;
alter default privileges in schema employee_app
  revoke all on sequences from anon, authenticated;
alter default privileges in schema employee_app
  revoke all on functions from anon, authenticated;

-- ------------------------------------------------------------
-- service_role explizit berechtigen. Supabase vergibt fuer NEUE Schemas
-- keine Grants automatisch — dieser Block ist die Voraussetzung dafuer,
-- dass die serverseitigen Routen ueberhaupt funktionieren.
-- ------------------------------------------------------------
grant usage on schema employee_app to service_role;
grant all on all tables in schema employee_app to service_role;
grant all on all sequences in schema employee_app to service_role;
alter default privileges in schema employee_app
  grant all on tables to service_role;
alter default privileges in schema employee_app
  grant all on sequences to service_role;

notify pgrst, 'reload schema';
