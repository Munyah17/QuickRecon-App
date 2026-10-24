# QuickRecon App

Next.js 16 / React 19 application backed by Supabase Auth, Postgres and Storage.
Use Node 24 and npm. Work in the existing checkout; cloud tasks are isolated.
In this cloud environment, export `NODE_USE_ENV_PROXY=1` before starting Node/npm
commands so Supabase requests use the managed HTTPS proxy.

## Run and verify

```sh
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev
npm test
npm run lint
npm run build
npm start
```

`npm test` covers auth redirects/cookie propagation, account-profile repair,
production configuration, staff authorization and PostgreSQL role migrations.
The SQL tests use PGlite with an isolated database, not the live project.
Fonts are bundled with the installed `geist` package; no Google Fonts download
is required. The workbench retains review notes in browser local storage.

## Backend configuration

Enter values securely in cloud environment settings or an ignored `.env.local`.
Never commit credentials. Rebuild after changing `NEXT_PUBLIC_*` variables:
Next.js embeds those values in the browser bundle at build time.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon/publishable project key; RLS must remain enabled |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key for authorized staff operations |
| `SUPABASE_ACCESS_TOKEN` | Optional short-lived management token for the backend diagnostic script |

The service-role key must never use a `NEXT_PUBLIC_` name. Permit HTTPS access
to the project hostname and, for management diagnostics, `api.supabase.com`.
Proxy-backed cloud secrets must be sent through their configured HTTPS destinations;
never copy proxy placeholder values into external deployments.

Without Supabase configuration, development uses sample sessions/data. Production
requires the backend by default; a deliberate demo deployment may set
`NEXT_PUBLIC_ENABLE_PREVIEW=true`. Partial or invalid configuration must not silently
turn real operations into fake successful writes or sample financial data.

Run `npm run check:backend` after credentials and network settings are applied.
It checks Auth, key access, required tables, missing profiles, anonymous profile
visibility, and the role helper when a management token is present. It does not
write to the database or print credential values. These checks do not replace
signing in as a real user and exercising role-specific workflows.

## Database and account recovery

Inspect the live schema/migration history before applying SQL. Apply missing
migrations in filename order. On an existing project with migrations through
0014, apply `supabase/migrations/0015_staff_role_helpers.sql` and
`supabase/migrations/0016_restore_missing_access_policies.sql`. These fix finance
and operations role resolution, deny inactive staff access, and restore absent
repository policies while preserving existing policy definitions.
The targeted management scripts `scripts/apply-staff-role-fix.mjs` and
`scripts/apply-access-policy-fix.mjs` inspect first; `--apply` saves rollback SQL
and performs the corresponding narrow update.
0014 adds enum values and must commit before 0015 uses them.

For a **new empty** project, `supabase/bootstrap.sql` contains the generated
schema through 0016. Regenerate with `node scripts/build-bootstrap.mjs` after
changing migrations. Review before running on an existing project: historical
migrations include data changes and removal of the assistants feature. Enum
additions introduce explicit transaction boundaries, so the full bootstrap is
not atomic. Take a database backup before upgrading an existing deployment.

Creating `auth.users` directly does not create the portal's `public.profiles` row.
Use User Management for future staff accounts. To link an existing confirmed
Auth account without replacing its password or overwriting an existing profile:

```sh
node scripts/repair-staff-profile.mjs --email munyamuzvidziwa19@gmail.com --role super_admin
# After reviewing the dry-run result:
node scripts/repair-staff-profile.mjs --email munyamuzvidziwa19@gmail.com --role super_admin --apply
```

The command reads credentials from the environment. For local `.env.local`, use
`node --env-file=.env.local scripts/repair-staff-profile.mjs ...`. Existing roles
and suspended profiles are left unchanged. Do not grant staff access based on
user-editable signup metadata. Agent accounts intentionally have no staff portal.

## Additional integrations

Supabase credentials alone do not enable these independent providers:

| Feature | Required configuration |
| --- | --- |
| Email delivery | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, verified `SMTP_FROM` |
| WhatsApp delivery | `WHATSAPP_PROVIDER=meta`, `WHATSAPP_API_KEY`, `WHATSAPP_SENDER_ID` |
| SMS | `AFROSOFT_API_KEY`, optionally `AFROSOFT_API_URL` |
| AI assistant | `GROQ_API_KEY` |

Configure provider credentials and network access securely before exercising
those features. SMTP requires a supported raw credential injection and SMTP
network path; an HTTPS proxy placeholder is not a usable SMTP password.
Live delivery tests send real messages and should use explicitly designated
test recipients. Configure Supabase Auth's Site URL and redirect allowlist for
the actual deployment domain and configure its email-confirmation delivery.
The login page links to `/forgot-password`; its recovery email uses
`/auth/callback?next=/reset-password`. The callback exchanges the PKCE code and
restricts destinations to local app routes. Invalid/expired links show a clear
message. Configure the exact callback URL in Supabase's redirect allowlist.
`/reset-password` requires a valid session and signs out after a successful
password update. Email delivery must be tested with an authorized recipient.

The desktop and mobile Sign Out controls revoke the local Supabase session
and remove HTTP-only preview cookies through a server action.
