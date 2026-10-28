-- Apply after 0014 has committed its enum additions. Do not rewrite account
-- roles or trust auth.users.raw_user_meta_data to grant staff privileges.
create or replace function public.current_role()
returns public.role_code language sql stable security definer set search_path = public as $$
  select case lower(trim((select role::text from public.profiles where id = auth.uid() and status::text = 'active')))
    when 'super_admin' then 'super_admin'::public.role_code
    when 'superadmin' then 'super_admin'::public.role_code
    when 'super admin' then 'super_admin'::public.role_code
    when 'admin' then 'admin'::public.role_code
    when 'administrator' then 'admin'::public.role_code
    when 'tech_support' then 'tech_support'::public.role_code
    when 'finance' then 'finance'::public.role_code
    when 'operations' then 'operations'::public.role_code
    when 'assistant' then 'assistant'::public.role_code
    else 'agent'::public.role_code
  end;
$$;

create or replace function public.is_company_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status::text = 'active' from public.profiles where id = auth.uid())
    and public.current_role() in ('super_admin','admin','tech_support','finance','operations'),
    false
  );
$$;
