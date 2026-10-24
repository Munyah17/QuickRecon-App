import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = (name) => readFileSync(`supabase/migrations/${name}`, 'utf8');

test('staff migrations preserve roles and authorize only active staff', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('test.user_id', true), '')::uuid
      $$;
      create type public.role_code as enum ('super_admin','admin','agent','assistant','tech_support');
      create table public.profiles (id uuid primary key, role text, status text);
    `);
    await db.exec(migration('0014_finance_operations_roles.sql'));
    const id = '00000000-0000-0000-0000-000000000001';
    await db.query('insert into profiles values ($1, $2, $3)', [id, 'finance', 'active']);
    await db.exec(`select set_config('test.user_id', '${id}', false)`);
    await db.exec(migration('0011_role_normalisation.sql'));
    assert.equal((await db.query('select role from profiles')).rows[0].role, 'finance', 'replaying normalization must preserve finance');
    await db.query('update profiles set role = $1', ['operations']);
    await db.exec(migration('0011_role_normalisation.sql'));
    assert.equal((await db.query('select role from profiles')).rows[0].role, 'operations', 'replaying normalization must preserve operations');
    await db.exec(migration('0015_staff_role_helpers.sql'));
    for (const role of ['super_admin', 'admin', 'tech_support', 'finance', 'operations']) {
      await db.query('update profiles set role = $1, status = $2', [role, 'active']);
      const result = (await db.query('select public.current_role() as role, is_company_user() as allowed')).rows[0];
      assert.equal(result.role, role);
      assert.equal(result.allowed, true);
    }
    for (const status of ['pending', 'suspended', 'inactive']) {
      await db.query('update profiles set status = $1', [status]);
      assert.equal((await db.query('select is_company_user() as allowed')).rows[0].allowed, false);
      assert.equal((await db.query('select public.current_role() as role')).rows[0].role, 'agent');
    }
    for (const role of ['agent', 'assistant', 'unknown']) {
      await db.query('update profiles set role = $1, status = $2', [role, 'active']);
      assert.equal((await db.query('select is_company_user() as allowed')).rows[0].allowed, false);
    }
    await db.query('update profiles set role = $1', [' SUPER ADMIN ']);
    assert.equal((await db.query('select public.current_role() as role')).rows[0].role, 'super_admin');
    await db.exec("select set_config('test.user_id', '', false)");
    assert.equal((await db.query('select is_company_user() as allowed')).rows[0].allowed, false);
    await db.exec(migration('0015_staff_role_helpers.sql'));
  } finally {
    await db.close();
  }
});

test('generated bootstrap applies and reruns without changing existing finance roles', async () => {
  const db = new PGlite();
  try {
    // Supabase owns these schemas in production. PGlite supplies PostgreSQL
    // semantics, while these minimal tables stand in for the hosted services.
    await db.exec(`
      create schema auth; create schema storage;
      create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('test.user_id', true), '')::uuid
      $$;
      create table auth.users(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean);
      create table storage.objects(id uuid primary key, bucket_id text, name text, owner uuid);
    `);
    // gen_random_uuid is built into PostgreSQL; PGlite does not bundle pgcrypto.
    const sql = readFileSync('supabase/bootstrap.sql', 'utf8').replace('create extension if not exists "pgcrypto";', '');
    await db.exec(sql);
    const id = '00000000-0000-0000-0000-000000000002';
    await db.query('insert into auth.users values ($1)', [id]);
    await db.query('insert into profiles (id, full_name, email, role, status) values ($1, $2, $3, $4, $5)', [id, 'Finance Test', 'finance@example.com', 'finance', 'active']);
    await db.exec(sql);
    assert.equal((await db.query('select role from profiles where id = $1', [id])).rows[0].role, 'finance');
    await db.exec(`select set_config('test.user_id', '${id}', false)`);
    assert.equal((await db.query('select public.current_role() as role, is_company_user() as allowed')).rows[0].allowed, true);
  } finally {
    await db.close();
  }
});

test('policy recovery restores authenticated profile reads while denying anonymous reads', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth; create schema storage;
      create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('test.user_id', true), '')::uuid
      $$;
      create table auth.users(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean);
      create table storage.objects(id uuid primary key, bucket_id text, name text, owner uuid);
    `);
    const sql = readFileSync('supabase/bootstrap.sql', 'utf8').replace('create extension if not exists "pgcrypto";', '');
    await db.exec(sql);
    const id = '00000000-0000-0000-0000-000000000003';
    await db.query('insert into auth.users values ($1)', [id]);
    await db.query('insert into profiles (id, full_name, email, role, status) values ($1, $2, $3, $4, $5)', [id, 'Staff Test', 'staff@example.com', 'super_admin', 'active']);
    await db.exec(`
      grant usage on schema public, auth to authenticated, anon;
      grant select on public.profiles to authenticated, anon;
      drop policy profiles_select_self on profiles;
      drop policy profiles_admin_write on profiles;
      drop policy profiles_update_self on profiles;
      select set_config('test.user_id', '${id}', false);
      set role authenticated;
    `);
    assert.equal((await db.query('select id from profiles')).rows.length, 0, 'reproduces valid auth but invisible profile');
    await db.exec('reset role');
    await db.exec(migration('0016_restore_missing_access_policies.sql'));
    await db.exec('set role authenticated');
    assert.equal((await db.query('select id from profiles')).rows.length, 1);
    await db.exec("reset role; select set_config('test.user_id', '', false); set role anon;");
    assert.equal((await db.query('select id from profiles')).rows.length, 0);
    await db.exec('reset role');
    const { rows: before } = await db.query("select count(*)::int as count from pg_policies");
    await db.exec(migration('0016_restore_missing_access_policies.sql'));
    assert.equal((await db.query("select count(*)::int as count from pg_policies")).rows[0].count, before[0].count);
  } finally {
    await db.close();
  }
});
