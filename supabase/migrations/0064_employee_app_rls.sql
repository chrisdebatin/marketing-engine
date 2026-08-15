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
