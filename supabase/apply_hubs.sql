-- Marketing-Engine: echte Hubs einspielen (ersetzt die Platzhalter-Hubs).
-- Einmal im Supabase SQL-Editor ausfuehren.
-- HINWEIS: Screenshot war unten abgeschnitten – ggf. weitere Hubs ergaenzen.

-- 1) Spalte fuer den verantwortlichen MD sicherstellen
alter table public.hubs add column if not exists responsible_md text;

-- 2) Platzhalter-Hubs ('Hub 01' .. 'Hub 18') entfernen
--    (loescht via Cascade auch deren user_hubs-Zuordnungen; noch keine Aktivitaeten vorhanden)
delete from public.hubs where name ~ '^Hub [0-9]+$';

-- 3) Echte Hubs einspielen (Name + verantwortlicher MD)
insert into public.hubs (name, responsible_md) values
  ('Dorsten',                 'Ben Etzrodt'),
  ('Alverdissen',             'Ben Etzrodt'),
  ('Bad Oeynhausen',          'Ben Etzrodt'),
  ('Rinteln',                 'Ben Etzrodt'),
  ('Hessisch-Oldendorf',      'Ben Etzrodt'),
  ('Bad Nenndorf',            'Ben Etzrodt'),
  ('Hameln',                  'Ben Etzrodt'),
  ('Bad Pyrmont',             'Ben Etzrodt'),
  ('Tagespflege Dorsten',     'Ben Etzrodt'),
  ('Alltagshilfe Dorsten',    'Heiko Matamaru'),
  ('Alltagshilfe Duisburg',   'Heiko Matamaru'),
  ('Alltagshilfe Düsseldorf', 'Heiko Matamaru'),
  ('Alltagshilfe Neuenrade',  'Heiko Matamaru'),
  ('Alltagshilfe Iserlohn',   'Heiko Matamaru'),
  ('Düsseldorf',              'Marcel Müller'),
  ('Kerpen',                  'Marcel Müller'),
  ('Velbert',                 'Melanie Martens'),
  ('Gevelsberg',              'Melanie Martens'),
  ('Alveo Care',              'Rachid Sabi'),
  ('Duisburg',                'Sebastian Fliegel'),
  ('Iserlohn',                'Sebastian Fliegel'),
  ('Neuenrade',               'Sebastian Fliegel'),
  ('Attendorn',               'Sebastian Fliegel'),
  ('Tagespflgege Duisburg',   'Sebastian Fliegel')
on conflict (name) do update set responsible_md = excluded.responsible_md;

-- 4) Admin-Konto allen Hubs zuordnen (zum Testen der Erfassung)
insert into public.user_hubs (user_id, hub_id)
select p.id, h.id
from public.profiles p
cross join public.hubs h
where p.id = (select id from auth.users where email = 'christopher.debatin@igs-holding.de')
on conflict do nothing;

-- 5) OPTIONAL – sobald die MDs eigene Logins haben (profiles.name = MD-Name),
--    ordne jeden MD automatisch seinen Hubs zu:
-- insert into public.user_hubs (user_id, hub_id)
-- select p.id, h.id
-- from public.profiles p
-- join public.hubs h on h.responsible_md = p.name
-- on conflict do nothing;
