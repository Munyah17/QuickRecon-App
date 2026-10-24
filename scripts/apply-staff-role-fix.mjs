/** Narrow, reversible helper update; does not rewrite profiles or account passwords. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN securely.');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];
async function query(sql, readOnly) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: readOnly }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Database request failed: HTTP ${response.status}.`);
  return response.json();
}
try {
  const [before] = await query(`select pg_get_functiondef('public.current_role()'::regprocedure) as role_helper,
    pg_get_functiondef('public.is_company_user()'::regprocedure) as company_helper,
    exists(select 1 from pg_enum where enumtypid='public.role_code'::regtype and enumlabel='finance') as finance,
    exists(select 1 from pg_enum where enumtypid='public.role_code'::regtype and enumlabel='operations') as operations;`, true);
  if (!before.finance || !before.operations) throw new Error('Apply and commit migration 0014 before this fix.');
  if (!process.argv.includes('--apply')) {
    console.log('Preflight passed. Rerun with --apply to back up and replace only the two staff-role helper functions.');
  } else {
    const backup = join(mkdtempSync(join(tmpdir(), 'quickrecon-role-backup-')), 'restore-helpers.sql');
    writeFileSync(backup, `begin;\n${before.role_helper};\n${before.company_helper};\ncommit;\n`, { mode: 0o600 });
    const sql = readFileSync('supabase/migrations/0015_staff_role_helpers.sql', 'utf8');
    await query(`begin;\n${sql}\nnotify pgrst, 'reload schema';\ncommit;`, false);
    console.log(`Applied migration 0015 helper definitions. Previous definitions saved at ${backup}. No account roles or passwords changed.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
