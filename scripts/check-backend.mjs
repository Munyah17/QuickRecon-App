/** Read-only Supabase readiness check. Credentials must come from the environment. */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in environment settings.');
  process.exit(1);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const sb = createClient(url, service, options);
const publicClient = createClient(url, anon, options);
let failed = false;
function report(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
  if (!ok) failed = true;
}
try {
  // A valid public key may read public auth settings; no user session needed.
  const auth = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, signal: AbortSignal.timeout(15000) });
  report('public auth endpoint', auth.ok, `HTTP ${auth.status}`);
  let users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Admin auth access failed (${error.status ?? 'unknown status'}).`);
    users = users.concat(data.users);
    if (data.users.length < 100) break;
  }
  report('service-role auth access', true, `${users.length} accounts`);
  const { data: profiles, error } = await sb.from('profiles').select('id, role, status');
  if (error) throw new Error(`Profiles query failed (${error.code ?? 'unknown code'}). Check migrations and access.`);
  const profileIds = new Set(profiles.map((p) => p.id));
  const missing = users.filter((user) => !profileIds.has(user.id));
  report('auth accounts have portal profiles', missing.length === 0, `${missing.length} missing profiles (field/non-portal accounts may intentionally have none)`);
  const tables = ['agents', 'agent_modules', 'booths', 'reconciliations', 'reconciliation_lines', 'import_batches', 'support_tickets', 'notifications', 'system_settings', 'erp_transactions', 'erp_requisitions', 'erp_documents', 'hr_records', 'communications'];
  for (const table of tables) {
    const { error } = await sb.from(table).select('*', { head: true, count: 'exact' });
    report(`table ${table}`, !error, error ? `database error ${error.code ?? 'unknown'}` : 'accessible');
  }
  // Anonymous clients must not see private staff profiles.
  const anonymous = await publicClient.from('profiles').select('id').limit(1);
  report('anonymous staff-profile access denied', Boolean(anonymous.error) || anonymous.data?.length === 0);
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    const ref = new URL(url).hostname.split('.')[0];
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `select pg_get_functiondef('public.current_role()'::regprocedure) as definition, pg_get_functiondef('public.is_company_user()'::regprocedure) as company_definition,
        exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_self') as profile_read_policy;`, read_only: true }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) report('database helper inspection', false, `HTTP ${response.status}`);
    else {
      const rows = await response.json();
      const definition = rows[0]?.definition ?? '';
      const company = rows[0]?.company_definition ?? '';
      report('staff RLS helper covers finance and operations', definition.includes("'finance'") && definition.includes("'operations'") && company.includes("'finance'") && company.includes("'operations'"));
      report('profile access policy exists', rows[0]?.profile_read_policy === true);
    }
  } else console.log('UNRUN database helper inspection: SUPABASE_ACCESS_TOKEN not set');
} catch (error) {
  // Do not print SDK request objects, headers or credential values.
  console.error(error instanceof Error ? error.message : 'Backend check failed.');
  failed = true;
}
process.exitCode = failed ? 1 : 0;
