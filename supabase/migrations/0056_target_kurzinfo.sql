-- 0056: KI-generierte Kurz-Info je Institution (z. B. "Maximalversorger,
-- ca. 1.400 Betten, Uniklinik") — einmalig erzeugt und hier gecacht,
-- angezeigt auf den Anruflisten-Karten.
alter table public.crm_targets add column if not exists kurzinfo text;

notify pgrst, 'reload schema';
