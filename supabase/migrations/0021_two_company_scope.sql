-- ---------------------------------------------------------------------------
-- 0021_two_company_scope.sql — per-user source-company assignment
--
-- Enpassent and Econet Moovah are two separate source companies feeding
-- reconciliation documents. A portal user is assigned one or both — the
-- assigned set is stored here and drives which modules the workspace exposes.
--
-- Idempotent: safe to run repeatedly or paste into the Supabase SQL editor.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists modules module_code[] not null default '{enpassent,econet-moovah}'::module_code[];

-- Existing staff keep access to both companies until an admin narrows it.
update public.profiles
   set modules = '{enpassent,econet-moovah}'::module_code[]
 where modules is null;

-- Reload PostgREST's schema cache so the new column is visible immediately.
notify pgrst, 'reload schema';
