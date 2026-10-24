/**
 * Repair an existing Supabase Auth account created outside User Management.
 * Dry run (default): node --env-file=.env.local scripts/repair-staff-profile.mjs --email staff@example.com --role admin
 * Apply after reviewing: append --apply. Requires server-side service-role credentials.
 * Never takes a password or trusts user-editable auth metadata for authorization.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  email: { type: 'string' }, role: { type: 'string' }, apply: { type: 'boolean', default: false },
} });
const roles = ['super_admin', 'admin', 'tech_support', 'finance', 'operations'];
const email = values.email?.trim().toLowerCase();
if (!email || !roles.includes(values.role)) {
  console.error(`Usage: node scripts/repair-staff-profile.mjs --email EMAIL --role ${roles.join('|')} [--apply]`);
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY securely before running this administrator-only script.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  let user;
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user || data.users.length < 100) break;
  }
  if (!user) throw new Error('No existing Auth account matches this email. No changes made.');
  if (!user.email_confirmed_at) throw new Error('Confirm this account through Supabase Auth before granting portal access. No changes made.');
  const { data: profile, error } = await sb.from('profiles').select('id, role, status').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (profile) {
    console.log(`A profile already exists (role: ${profile.role}, status: ${profile.status}). Use User Management to change it. No changes made.`);
  } else if (!values.apply) {
    console.log(`Dry run: would create an active ${values.role} profile for ${email}. Review the intended staff role, then rerun with --apply. The password will remain unchanged.`);
  } else {
    const { error: insertError } = await sb.from('profiles').insert({
      id: user.id, email, role: values.role, status: 'active',
      full_name: user.user_metadata?.full_name || email,
    });
    if (insertError) throw insertError;
    console.log('Staff profile created. The existing account can now sign in with its original password.');
  }
} catch (error) {
  console.error(`Profile repair failed: ${error.message}`);
  process.exitCode = 1;
}
