-- Normalise legacy/alias role strings stored in profiles.role and make the
-- RLS helper functions resilient to non-enum values.
--
-- Context: some environments have profiles.role as TEXT (schema drift), which
-- allowed values like 'superadmin' and 'customer'. current_role() returns
-- role_code, so reading such a row threw a cast error and EVERY RLS policy
-- failed for that caller — pages silently rendered empty while privileged
-- service-role writes still succeeded.

-- 1. Data fix: map any non-standard value to a valid role_code.
update public.profiles
set role = case role::text
  when 'superadmin' then 'super_admin'
  when 'super admin' then 'super_admin'
  when 'administrator' then 'admin'
  when 'customer' then 'agent'
  else 'agent'
end
where role::text not in ('super_admin', 'admin', 'agent', 'assistant', 'tech_support');

-- 2. Hardened helpers: read as text, map known aliases, fall back to 'agent'
-- instead of erroring on unexpected values.
create or replace function public.current_role()
returns role_code language sql stable security definer set search_path = public as $$
  select case (select role::text from public.profiles where id = auth.uid())
    when 'super_admin' then 'super_admin'::role_code
    when 'superadmin' then 'super_admin'::role_code
    when 'admin' then 'admin'::role_code
    when 'administrator' then 'admin'::role_code
    when 'assistant' then 'assistant'::role_code
    when 'tech_support' then 'tech_support'::role_code
    else 'agent'::role_code
  end;
$$;

create or replace function public.is_company_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('super_admin', 'admin', 'tech_support');
$$;
