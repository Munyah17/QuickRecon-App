-- Remove the assistants feature entirely.
--
-- Assistants never get portal access anymore; agents keep their identity
-- rows (agents table) purely for report delivery via email/WhatsApp.
--
-- Note: the 'assistant' role_code enum value is intentionally left in place.
-- Dropping an enum value requires recreating the type, which would cascade
-- into current_role() and every RLS policy that depends on it. No code path
-- can create an assistant anymore, so the value is inert.

-- 1. Remove assistant permission grants and keys.
delete from public.role_permissions where permission like 'assistants.%';
delete from public.permissions where key like 'assistants.%';

-- 2. Leftover assistant profiles lose their role — 'agent' also has no
--    portal access, so this is a safe tombstone rather than a delete that
--    could break FK references (e.g. approved_by).
update public.profiles set role = 'agent' where role::text = 'assistant';

-- 3. Drop the parent-agent linkage column on profiles.
alter table public.profiles drop column if exists parent_agent_id;

-- 4. Drop the assistants table (index, RLS policies drop with it).
drop table if exists public.assistants;

-- 5. Hardened helper: 'assistant' maps to 'agent' — field roles have no
--    portal access and is_company_user() excludes them either way.
create or replace function public.current_role()
returns role_code language sql stable security definer set search_path = public as $$
  select case (select role::text from public.profiles where id = auth.uid())
    when 'super_admin' then 'super_admin'::role_code
    when 'superadmin' then 'super_admin'::role_code
    when 'admin' then 'admin'::role_code
    when 'administrator' then 'admin'::role_code
    when 'tech_support' then 'tech_support'::role_code
    else 'agent'::role_code
  end;
$$;
