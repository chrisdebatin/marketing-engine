-- 0050: Meta-Leads erscheinen zusätzlich im CRM (crm_targets) — als eigene
-- Kategorien meta_mitarbeiter / meta_kunde, getrennt von den Krankenhäusern.
-- crm_target_id verknüpft Lead ↔ CRM-Eintrag und macht den Sync idempotent.
alter table public.meta_leads
  add column if not exists crm_target_id uuid references public.crm_targets(id) on delete set null;

notify pgrst, 'reload schema';
