-- ============================================================
-- MD-Rolle aktivieren (einmalig im Supabase SQL-Editor einfuegen)
-- Entspricht migrations/0014_md_role.sql.
-- ============================================================
--
-- Was das macht: erlaubt in profiles.role zusaetzlich den Wert 'md'.
-- Ein MD sieht nach dem Login NUR die Hubs, die ihm in user_hubs
-- zugeordnet sind. Ohne Login verhaelt sich die App weiterhin wie
-- bisher (Open-Access, alle Hubs sichtbar).
--
-- Bewusst KEINE RLS-Aenderungen: RLS bleibt deaktiviert (0008_open_access);
-- das Scoping laeuft serverseitig. RLS-Haertung ist ein spaeterer Schritt.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'md', 'employee'));

-- ============================================================
-- So legst du einen MD-Nutzer an (Beispiele, auskommentiert):
-- ============================================================
--
-- Schritt 1: Nutzer in Supabase anlegen
--   Dashboard -> Authentication -> Users -> "Add user"
--   (E-Mail eintragen; "Auto Confirm User" aktivieren, damit der
--   Magic-Link-Login sofort funktioniert.)
--   Der Trigger handle_new_user legt automatisch eine profiles-Zeile
--   mit role='employee' an.
--
-- Schritt 2: Rolle auf 'md' setzen (E-Mail anpassen):
--
-- update public.profiles
--   set role = 'md', name = 'Vorname Nachname'
--   where id = (select id from auth.users where email = 'md@example.com');
--
-- Schritt 3: Hubs zuordnen (Hub-Namen anpassen; beliebig viele moeglich):
--
-- insert into public.user_hubs (user_id, hub_id)
-- select (select id from auth.users where email = 'md@example.com'), h.id
-- from public.hubs h
-- where h.name in ('Hub Beispielstadt', 'Hub Musterhausen')
-- on conflict do nothing;
--
-- Kontrolle: welche Hubs sieht der MD?
--
-- select p.name, p.role, h.name as hub
-- from public.profiles p
-- join public.user_hubs uh on uh.user_id = p.id
-- join public.hubs h on h.id = uh.hub_id
-- where p.id = (select id from auth.users where email = 'md@example.com');
--
-- Hub-Zuordnung wieder entfernen:
--
-- delete from public.user_hubs
-- where user_id = (select id from auth.users where email = 'md@example.com')
--   and hub_id = (select id from public.hubs where name = 'Hub Beispielstadt');
