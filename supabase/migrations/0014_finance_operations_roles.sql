-- 0014_finance_operations_roles.sql
-- The app code and staff-management UI already grant dashboard access to the
-- "finance" and "operations" company roles, but the role_code enum rejected
-- them, so profiles for these roles could never be created.

alter type public.role_code add value if not exists 'finance';
alter type public.role_code add value if not exists 'operations';

-- Extend the company-role gate so existing RLS policies cover the new roles.
create or replace function public.is_company_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role::text in ('super_admin','admin','tech_support','finance','operations') from public.profiles where id = auth.uid()),
    false
  );
$$;
