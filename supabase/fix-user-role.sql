-- Fix: restore super_admin role for a staff account.
-- This fixes the immediate logout issue caused by migration 0011.
-- Replace the placeholder with the account email before running.

update public.profiles
set role = 'super_admin'
where email = '<staff-email-here>';

-- Verify the fix
select id, full_name, email, role, status from public.profiles where email = '<staff-email-here>';
