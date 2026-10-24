/** Restore only absent repository access policies; leave existing definitions and RLS intact. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN securely.'); process.exit(1); }
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
  const sql = readFileSync('supabase/migrations/0016_restore_missing_access_policies.sql', 'utf8');
  const existing = await query("select schemaname, tablename, policyname from pg_policies where schemaname in ('public','storage');", true);
  const names = new Set(existing.map((row) => `${row.schemaname}.${row.tablename}:${row.policyname}`));
  const required = [...sql.matchAll(/schemaname = '([^']+)' and tablename = '([^']+)' and policyname = '([^']+)'/g)].map((m) => ({ schema: m[1], table: m[2], name: m[3] }));
  const missing = required.filter((p) => !names.has(`${p.schema}.${p.table}:${p.name}`));
  console.log(`${missing.length} baseline policies missing.`);
  if (process.argv.includes('--apply') && missing.length) {
    const backup = join(mkdtempSync(join(tmpdir(), 'quickrecon-policy-backup-')), 'undo-added-policies.sql');
    writeFileSync(backup, `begin;\n${missing.map((p) => `drop policy if exists "${p.name}" on ${p.schema}.${p.table};`).join('\n')}\ncommit;\n`, { mode: 0o600 });
    await query(`begin;\n${sql}\nnotify pgrst, 'reload schema';\ncommit;`, false);
    console.log(`Restored ${missing.length} policies. Existing definitions unchanged. Rollback saved at ${backup}.`);
  } else if (missing.length) console.log('Rerun with --apply to restore absent policies.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
