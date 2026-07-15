-- MD-Rolle: profiles.role darf jetzt auch 'md' sein (Marketing/Vertrieb im
-- Feld, sieht nur die eigenen Hubs aus user_hubs).
--
-- Bewusst KEINE RLS-Aenderungen: Die App laeuft im Open-Access-Modus
-- (RLS ist seit 0008_open_access.sql deaktiviert). Das Hub-Scoping fuer
-- eingeloggte MD-Nutzer passiert serverseitig in requireSession()
-- (src/lib/auth.ts) und in den Server Actions. RLS wieder zu haerten ist
-- ein bewusster spaeterer Schritt, sobald Open-Access abgeschaltet wird.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'md', 'employee'));
