-- ============================================================================
-- 0009_staff_payment_methods.sql — real staff directory + remuneration
-- payment methods (bank accounts, mobile money, other) for staff & agents.
-- ============================================================================

-- ── Staff (executive employees) ─────────────────────────────────────────────
-- Employees are not necessarily auth users, so they live in their own table
-- rather than public.profiles. Salaries are confidential figures — they belong
-- in the DB behind RLS, not in the client bundle.
create table public.staff (
  id text primary key,                          -- EMP-001
  full_name text not null,
  job_title text,                               -- CTO, Clerk, Insurer…
  department text,
  salary numeric(14,2) not null default 0,
  status text not null default 'active',     -- free-form HR status: active, on_leave, exited…
  phone text,
  email text,
  user_id uuid references public.profiles (id), -- optional link to a login
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.staff (status);
create index on public.staff (department);

alter table public.staff enable row level security;
create policy "staff_company" on public.staff for all
  using (public.is_company_user())
  with check (public.is_company_user());

-- Seed a sample staff directory so the directory isn't empty on rollout.
-- Sample data only — enter real employees (and their remuneration details)
-- through the HR portal; PII must never live in source control.
insert into public.staff (id, full_name, job_title, department, salary, status, phone, email) values
  ('EMP-001','Sample Executive','Chief Executive','Executive',65000,'active','+263 00 000 0001','emp001@preview.local'),
  ('EMP-002','Sample Operations Lead','Chief Operations Officer','Executive',48000,'active','+263 00 000 0002','emp002@preview.local'),
  ('EMP-003','Sample Finance Lead','Chief Financial Officer','Executive',45000,'active','+263 00 000 0003','emp003@preview.local'),
  ('EMP-004','Sample Technology Lead','Chief Technology Officer','Executive',42000,'active','+263 00 000 0004','emp004@preview.local'),
  ('EMP-005','Sample Underwriting Manager','Underwriting Manager','Underwriting',35000,'active','+263 00 000 0005','emp005@preview.local'),
  ('EMP-006','Sample Claims Manager','Claims Manager','Claims',32000,'active','+263 00 000 0006','emp006@preview.local'),
  ('EMP-007','Sample Risk Manager','Risk Manager','Risk',30000,'active','+263 00 000 0007','emp007@preview.local'),
  ('EMP-008','Sample Risk Assessor','Risk Assessor','Risk',25000,'active','+263 00 000 0008','emp008@preview.local'),
  ('EMP-009','Sample Accountant','Accountant','Finance',28000,'active','+263 00 000 0009','emp009@preview.local'),
  ('EMP-010','Sample Tech Support','Tech Support','IT',22000,'active','+263 00 000 0010','emp010@preview.local'),
  ('EMP-011','Sample Clerk','Clerk','Operations',18000,'active','+263 00 000 0011','emp011@preview.local'),
  ('EMP-012','Sample Insurer','Insurer','Insurance',24000,'on_leave','+263 00 000 0012','emp012@preview.local')
on conflict (id) do nothing;

-- ── Payment methods (remuneration banking details) ──────────────────────────
-- One row per method so a profile can hold 3+ optional accounts: bank accounts,
-- mobile-money wallets (EcoCash / OneMoney / InnBucks…) and anything else.
-- owner_type 'staff' → staff.id (EMP-…); 'agent' → agents.id (AGT-…).
create table public.payment_methods (
  id bigint generated always as identity primary key,
  owner_type text not null check (owner_type in ('staff','agent')),
  owner_id text not null,
  kind text not null check (kind in ('bank','mobile_money','other')),
  label text,                                    -- e.g. "Primary", "EcoCash"
  -- bank
  bank_name text,
  branch_code text,
  account_name text,
  account_number text,
  -- mobile money / other
  provider text,                                 -- ecocash|onemoney|innbucks|other
  mobile_number text,
  -- shared
  currency text not null default 'USD',
  is_primary boolean not null default false,
  details jsonb not null default '{}'::jsonb,    -- swift, iban, notes…
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_methods (owner_type, owner_id);
create index on public.payment_methods (owner_id);

alter table public.payment_methods enable row level security;
-- Company staff manage everyone's remuneration details.
create policy "payment_methods_company" on public.payment_methods for all
  using (public.is_company_user())
  with check (public.is_company_user());
-- Agents may read (only) their own payment methods.
create policy "payment_methods_agent_read_own" on public.payment_methods for select
  using (owner_type = 'agent' and owner_id = public.current_agent_id());
