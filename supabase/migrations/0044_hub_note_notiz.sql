-- 0044: Freitext-Notiz an Kampagnen-Anfragen (Kanban-Karten) —
-- z. B. Zwischenstände ("Warten auf Freigabe", "Budget geklärt").

alter table public.hub_notes add column if not exists notiz text;

notify pgrst, 'reload schema';
