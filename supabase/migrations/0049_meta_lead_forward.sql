-- 0049: Automatische Weiterleitung von Mitarbeiter-Leads an das Recruiting-
-- Postfach (LEAD_FORWARD_TO, Default recruiting@igsg.de). Der Sync
-- verschickt je Lead genau eine Mail; forwarded_at macht das idempotent.
alter table public.meta_leads
  add column if not exists forwarded_at  timestamptz,
  add column if not exists forward_error text;

notify pgrst, 'reload schema';
