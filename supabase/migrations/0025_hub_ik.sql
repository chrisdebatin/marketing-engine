-- IK-Nummer (Institutionskennzeichen) je Hub/Standort — u. a. Grundlage
-- für das geplante Recare-Feature. Altbestand: null.
alter table public.hubs
  add column if not exists ik_nummer text;
