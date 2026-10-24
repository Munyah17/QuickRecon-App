import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const loadDependency = createRequire(import.meta.url);

function load(file, mocks, environment = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(js, {
    exports, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test', ...environment } },
    console, require: (name) => name in mocks ? mocks[name] : loadDependency(name),
  }, { filename: file });
  return exports;
}

function proxyWith(user, refresh = false) {
  return load('proxy.ts', {
    '@supabase/ssr': {
      createServerClient: (_url, _key, options) => ({ auth: {
        getUser: async () => {
          if (refresh) options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'refreshed', options: { path: '/', httpOnly: true } }]);
          return { data: { user } };
        },
      } }),
    },
  }).proxy;
}

test('login remains reachable with an auth cookie and an unusable profile', async () => {
  const response = await proxyWith({ id: 'staff' })(new NextRequest('http://localhost/login'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});
test('anonymous dashboard redirects and preserves auth cookie cleanup/refresh', async () => {
  const response = await proxyWith(null, true)(new NextRequest('http://localhost/app/dashboard'));
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  assert.equal(response.cookies.get('sb-test-auth-token').value, 'refreshed');
});
test('refreshed cookies reach both the browser and downstream server render', async () => {
  const response = await proxyWith({ id: 'staff' }, true)(new NextRequest('http://localhost/app/dashboard'));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get('sb-test-auth-token').value, 'refreshed');
  assert.match(response.headers.get('x-middleware-request-cookie'), /sb-test-auth-token=refreshed/);
});

function loginWith(profile) {
  const state = { signedOut: false };
  const supabase = {
    auth: {
      signInWithPassword: async (input) => { state.input = input; return { data: { user: { id: 'staff' } }, error: null }; },
      signOut: async () => { state.signedOut = true; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  };
  const actions = load('app/login/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/auth/profile': load('lib/auth/profile.ts', {}),
    'next/headers': {},
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  });
  return { login: actions.loginWithPassword, state };
}
for (const status of ['inactive', 'suspended']) {
  test(`${status} accounts are rejected before redirecting`, async () => {
    const { login, state } = loginWith({ role: 'admin', status });
    assert.match((await login('staff@example.com', 'password')).error, /inactive|suspended/);
    assert.equal(state.signedOut, true);
  });
}
test('missing signup profile reports an actionable error and clears session', async () => {
  const { login, state } = loginWith(null);
  assert.match((await login('staff@example.com', 'password')).error, /no portal profile/);
  assert.equal(state.signedOut, true);
});
test('active staff sign in with normalized email', async () => {
  const { login, state } = loginWith({ role: 'admin', status: 'active' });
  await assert.rejects(login(' Staff@Example.com ', 'password'), /REDIRECT:\/app\/dashboard/);
  assert.equal(state.input.email, 'staff@example.com');
  assert.equal(state.signedOut, false);
});
test('field-agent accounts retain the staff-only portal restriction', async () => {
  const { login, state } = loginWith({ role: 'agent', status: 'active' });
  assert.match((await login('agent@example.com', 'password')).error, /company staff/);
  assert.equal(state.signedOut, true);
});

test('configured backend never reports successful account creation without service credentials', async () => {
  const { POST } = load('app/api/users/route.ts', {
    '@/lib/auth/session': { getSession: async () => ({ user: { role: 'super_admin' } }) },
    '@/lib/auth/permissions': { permissionsForRole: () => ['users.create'] },
    '@/lib/supabase/server': { createServiceClient: async () => null },
  });
  const response = await POST(new NextRequest('http://localhost/api/users', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'New Staff', email: 'new@example.com', role: 'admin' }),
  }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /service role/);
});

async function repairProfile({ existing = null, confirmed = true, apply = false } = {}) {
  const state = { writes: [] };
  const sb = {
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 'staff', email: 'staff@example.com', email_confirmed_at: confirmed ? '2026-01-01' : null }] } }) } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      insert: async (row) => { state.writes.push(row); return { error: null }; },
    }),
  };
  const mocks = {
    '@supabase/supabase-js': { createClient: () => sb },
    'node:util': { parseArgs: () => ({ values: { email: 'staff@example.com', role: 'admin', apply } }) },
  };
  const js = ts.transpileModule(fs.readFileSync('scripts/repair-staff-profile.mjs', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const processMock = { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test' } };
  await vm.runInNewContext(`(async () => { ${js} })()`, {
    exports: {}, process: processMock, console: { log() {}, error() {} }, require: (name) => mocks[name],
  });
  return { ...state, exitCode: processMock.exitCode };
}
test('profile repair dry run never writes', async () => {
  assert.equal((await repairProfile()).writes.length, 0);
});
test('profile repair links confirmed account with explicit staff role and no password change', async () => {
  const state = await repairProfile({ apply: true });
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].id, 'staff');
  assert.equal(state.writes[0].role, 'admin');
  assert.equal(state.writes[0].status, 'active');
  assert.equal('password' in state.writes[0], false);
});
test('profile repair does not overwrite existing profiles or reactivate suspended accounts', async () => {
  assert.equal((await repairProfile({ existing: { role: 'admin', status: 'suspended' }, apply: true })).writes.length, 0);
});
test('profile repair refuses unconfirmed accounts', async () => {
  const state = await repairProfile({ confirmed: false, apply: true });
  assert.equal(state.writes.length, 0);
  assert.equal(state.exitCode, 1);
});


test('production cannot silently enter a sample super-admin session', () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, NODE_ENV: 'production' };
  assert.equal(load('lib/supabase/config.ts', {}, env).isPreviewMode(), false);
  assert.equal(load('lib/supabase/config.ts', {}, { ...env, NEXT_PUBLIC_ENABLE_PREVIEW: 'true' }).isPreviewMode(), true);
  assert.equal(load('lib/supabase/config.ts', {}, { ...env, NODE_ENV: 'development' }).isPreviewMode(), true);
});
test('login policy accepts staff aliases and rejects pending and unknown roles', () => {
  const { portalRole, profileAccessError } = load('lib/auth/profile.ts', {});
  assert.equal(portalRole(' Super Admin '), 'super_admin');
  assert.equal(portalRole('administrator'), 'admin');
  assert.equal(profileAccessError({ role: 'finance', status: 'active' }), null);
  assert.equal(profileAccessError({ role: 'operations', status: 'active' }), null);
  assert.match(profileAccessError({ role: 'admin', status: 'pending' }), /pending/);
  assert.match(profileAccessError({ role: 'unknown', status: 'active' }), /company staff/);
});

test('logout revokes the local auth session and removes the HTTP-only preview cookie', async () => {
  let revoked = false;
  let removed = false;
  const { logout } = load('app/login/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { signOut: async ({ scope }) => { assert.equal(scope, 'local'); revoked = true; return { error: null }; } } }) },
    '@/lib/auth/profile': load('lib/auth/profile.ts', {}),
    'next/headers': { cookies: async () => ({ delete: (name) => { assert.equal(name, 'qr_preview_role'); removed = true; } }) },
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  });
  await assert.rejects(logout(), /REDIRECT:\/login/);
  assert.equal(revoked, true);
  assert.equal(removed, true);
});

for (const [next, expected] of [['/reset-password', '/reset-password'], ['https://untrusted.example', '/app/dashboard']]) {
  test(`auth callback restricts redirect destination: ${next}`, async () => {
    let exchanged = false;
    const { GET } = load('app/auth/callback/route.ts', {
      '@/lib/supabase/server': { createClient: async () => ({ auth: { exchangeCodeForSession: async (code) => { assert.equal(code, 'test-code'); exchanged = true; return { error: null }; } } }) },
    });
    const response = await GET(new NextRequest(`http://localhost/auth/callback?code=test-code&next=${encodeURIComponent(next)}`));
    assert.equal(new URL(response.headers.get('location')).pathname, expected);
    assert.equal(new URL(response.headers.get('location')).origin, 'http://localhost');
    assert.equal(exchanged, true);
  });
}
test('invalid recovery code returns an actionable login error', async () => {
  const { GET } = load('app/auth/callback/route.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { message: 'expired' } }) } }) },
  });
  const response = await GET(new NextRequest('http://localhost/auth/callback?code=test-code'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  assert.equal(new URL(response.headers.get('location')).searchParams.get('authError'), 'expired');
});
