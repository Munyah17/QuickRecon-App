-- Staff identity/contact fields on profiles so National ID, phone and
-- location captured in Staff Management persist for every role — not just
-- agents (who already store national_id on the agents table).
alter table public.profiles
  add column if not exists national_id text,
  add column if not exists phone text,
  add column if not exists location text;
