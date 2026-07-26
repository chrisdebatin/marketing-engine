-- 0028: E-Mail-Adresse des zuständigen MD je Hub — für die wöchentlichen
-- Marketing-Updates per Outlook. Gleiche MD-Person darf auf mehreren Hubs
-- dieselbe Adresse haben.
alter table public.hubs add column if not exists md_email text;

notify pgrst, 'reload schema';
