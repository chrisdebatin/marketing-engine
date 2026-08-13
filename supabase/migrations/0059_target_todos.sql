-- To-dos auch an Outbound-Kontakten (crm_targets): die KI liest die
-- Anruf-Notiz und legt daraus Aufgaben an ("Flyer schicken").
alter table public.lead_todos drop constraint if exists lead_todos_lead_kind_check;
alter table public.lead_todos
  add constraint lead_todos_lead_kind_check
  check (lead_kind in ('call', 'meta', 'target'));

notify pgrst, 'reload schema';
