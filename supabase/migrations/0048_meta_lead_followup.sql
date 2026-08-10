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
