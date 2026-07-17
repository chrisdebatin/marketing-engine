-- Marketing-Engine – seed data
-- Run after the migrations (Supabase SQL editor or `supabase db reset` picks it up).

-- Material catalog (extend anytime; no code change needed)
insert into public.material_types (name, sort_order) values
  ('Flyer', 10),
  ('Aufsteller', 20)
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- Hubs (name + responsible MD). Extend/adjust as needed.
-- ------------------------------------------------------------
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
  ('Pflegeunion Intensiv',    'Rachid Sabi'),
  ('Duisburg',                'Sebastian Fliegel'),
  ('Iserlohn',                'Sebastian Fliegel'),
  ('Neuenrade',               'Sebastian Fliegel'),
  ('Attendorn',               'Sebastian Fliegel'),
  ('Tagespflgege Duisburg',   'Sebastian Fliegel')
on conflict (name) do update set responsible_md = excluded.responsible_md;

-- ------------------------------------------------------------
-- Promote yourself to admin after your first login, e.g.:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ------------------------------------------------------------
