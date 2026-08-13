-- 0054: Patienten-Übergabe an PDLs. Das Team weist einen Lead einem
-- Standort zu (zugewiesen_*), die PDL bekommt eine Mail und bestätigt auf
-- ihrer Standort-Seite "in die Versorgung aufgenommen" (pdl_bestaetigt_at).
-- Response-Zeit = pdl_bestaetigt_at - zugewiesen_at (Admin-Auswertung).
alter table public.lead_calls
  add column if not exists zugewiesen_hub_id uuid references public.hubs(id) on delete set null,
  add column if not exists zugewiesen_at timestamptz,
  add column if not exists pdl_bestaetigt_at timestamptz,
  add column if not exists pdl_ergebnis text;

alter table public.meta_leads
  add column if not exists zugewiesen_hub_id uuid references public.hubs(id) on delete set null,
  add column if not exists zugewiesen_at timestamptz,
  add column if not exists pdl_bestaetigt_at timestamptz,
  add column if not exists pdl_ergebnis text;

notify pgrst, 'reload schema';
