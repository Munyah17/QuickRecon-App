-- Seed the portal staff accounts in Supabase Auth so every sign-in is
-- authenticated against the database. Passwords are stored only as bcrypt
-- hashes (pgcrypto crypt()). This replaces the plaintext PREVIEW_CREDENTIALS
-- map that previously lived in app/login/actions.ts.
--
-- Idempotent: each account is resolved by email. If the auth user already
-- exists, its password is reset to the seeded value and the identity/profile
-- rows are relinked to the existing id — safe to re-run.
--
-- NOTE: apply once per environment. Rotate the seeded passwords afterwards —
-- an earlier commit exposed the plaintext values in git history.

create extension if not exists pgcrypto;

do $$
declare
  acct record;
  uid  uuid;
begin
  for acct in select * from (values
    ('munyamuzvidziwa19@gmail.com', '@@Griezmann177#$', 'Munyah Griezmann', 'super_admin'),
    ('support@enpassent.co.zw',     'support123',       'Taridzo Support',  'tech_support'),
    ('ops@enpassent.co.zw',         'admin123',         'Tererai Chiweshe', 'admin')
  ) as t(email, password, full_name, role)
  loop
    select id into uid from auth.users where email = acct.email;

    if uid is null then
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        acct.email,
        crypt(acct.password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        now(), now()
      )
      on conflict do nothing
      returning id into uid;

      -- Lost a race or skipped by conflict — recover the real id.
      if uid is null then
        select id into uid from auth.users where email = acct.email;
      end if;
    else
      -- Account exists: make sure the seeded password + confirmation work.
      update auth.users
      set encrypted_password = crypt(acct.password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = uid;
    end if;

    insert into auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      uid,
      uid::text,
      jsonb_build_object('sub', uid::text, 'email', acct.email),
      'email', now(), now(), now()
    ) on conflict do nothing;

    insert into public.profiles (id, full_name, email, role, status)
    values (uid, acct.full_name, acct.email, acct.role::role_code, 'active')
    on conflict do nothing;

    -- Ensure the profile carries the seeded role/status even if a row
    -- already existed (e.g. an account created via Auth then fixed up here).
    update public.profiles
    set role = acct.role::role_code,
        full_name = acct.full_name,
        status = 'active'
    where email = acct.email;
  end loop;
end $$;
