-- 0046: Video-Creatives für den Meta-Ads-Agenten. meta_video_id speichert
-- die ID des zu Meta hochgeladenen Videos, damit ein Retry (Meta verarbeitet
-- Videos asynchron) nicht erneut hochladen muss.
alter table public.meta_creatives add column if not exists meta_video_id text;

notify pgrst, 'reload schema';
