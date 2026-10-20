-- Fix: Restore super_admin role for munyamuzvidziwa19@gmail.com
-- This fixes the immediate logout issue caused by migration 0011

update public.profiles
set role = 'super_admin'
where email = 'munyamuzvidziwa19@gmail.com';

-- Verify the fix
select id, full_name, email, role, status from public.profiles where email = 'munyamuzvidziwa19@gmail.com';
