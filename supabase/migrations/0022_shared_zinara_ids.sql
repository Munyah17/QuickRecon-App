-- ---------------------------------------------------------------------------
-- 0022_shared_zinara_ids.sql — ZINARA codes are not unique identities
--
-- By company arrangement several agents may trade through the same ZINARA
-- account (or one that belongs to a colleague). The (scheme, value) unique
-- constraint rejected the second agent outright — and worse, the API's
-- conflict fallback re-pointed the code away from its original holder.
--
-- Uniqueness now applies to every scheme EXCEPT zinara_user / zinara_id.
-- Company codes (enpassent_user_id, econet_id), POS terminals and bank
-- account ids stay strictly unique.
--
-- Idempotent: safe to run repeatedly or paste into the Supabase SQL editor.
-- NOTE: with a partial index there is no (scheme,value) arbiter for
-- INSERT ... ON CONFLICT — the app claims ids via select + insert instead.
-- ---------------------------------------------------------------------------

alter table public.agent_external_ids
  drop constraint if exists agent_external_ids_scheme_value_key;

create unique index if not exists agent_external_ids_scheme_value_key
  on public.agent_external_ids (scheme, value)
  where scheme not in ('zinara_user', 'zinara_id');

-- Reload PostgREST's schema cache so the change is visible immediately.
notify pgrst, 'reload schema';
