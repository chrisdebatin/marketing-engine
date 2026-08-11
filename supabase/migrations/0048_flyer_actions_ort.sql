-- 0048: Verteilgebiet (Ort) als eigenes Feld an Flyeraktionen — wird von
-- der KI-Freitext-Erfassung befüllt und im Titel angezeigt. Backfill für
-- die bestehenden Einträge (Gebiet stand bisher nur im Notiz-Text).
alter table public.flyer_actions add column if not exists ort text;

update public.flyer_actions set ort = 'Duisburg'
  where ort is null and id = 'b2555e3e-7ce3-439b-a84b-8791067194cf';
update public.flyer_actions set ort = 'Dorsten & Schermbeck'
  where ort is null and id = '2766ef5d-56af-460a-948c-34c5c7e34374';
update public.flyer_actions set ort = 'Erkrath'
  where ort is null and id = '299d9507-f354-4e9b-8ef5-094d6bc6d948';
update public.flyer_actions set ort = 'Düsseldorf-Süd'
  where ort is null and id = '870abe2f-c004-4359-bf07-0f76b024f3cb';
update public.flyer_actions set ort = 'Düsseldorf'
  where ort is null and id = 'd5190b1f-c44e-4036-a30c-9c0bf5769e8a';

notify pgrst, 'reload schema';
