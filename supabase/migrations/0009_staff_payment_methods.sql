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
  status user_status not null default 'active',
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

-- Seed the current executive team so the directory isn't empty on rollout.
insert into public.staff (id, full_name, job_title, department, salary, status, phone, email) values
  ('EMP-001','Munyah Griezmann','CTO','Executive',65000,'active','+263 77 123 4567','munyamuzvidziwa19@gmail.com'),
  ('EMP-002','Tererai Chiweshe','Chief Operations Officer','Executive',48000,'active','+263 77 234 5678','tererai@quickrecon.co.zw'),
  ('EMP-003','Rumbi Chiweshe','Chief Financial Officer','Executive',45000,'active','+263 77 345 6789','rumbi@quickrecon.co.zw'),
  ('EMP-004','Tafadzwa Ncube','Chief Technology Officer','Executive',42000,'active','+263 77 456 7890','tafadzwa@quickrecon.co.zw'),
  ('EMP-005','Farai Mlambo','Underwriting Manager','Underwriting',35000,'active','+263 77 567 8901','farai@quickrecon.co.zw'),
  ('EMP-006','Nyasha Dube','Claims Manager','Claims',32000,'active','+263 77 678 9012','nyasha@quickrecon.co.zw'),
  ('EMP-007','Tariro Moyo','Risk Manager','Risk',30000,'active','+263 77 789 0123','tariro@quickrecon.co.zw'),
  ('EMP-008','Kudzai Sibanda','Risk Assessor','Risk',25000,'active','+263 77 890 1234','kudzai@quickrecon.co.zw'),
  ('EMP-009','Chipo Mhondoro','Accountant','Finance',28000,'active','+263 77 901 2345','chipo@quickrecon.co.zw'),
  ('EMP-010','Tendai Support','Tech Support','IT',22000,'active','+263 77 012 3456','tendai@quickrecon.co.zw'),
  ('EMP-011','Rumbi Taruvinga','Clerk','Operations',18000,'active','+263 77 123 4567','rumbi.t@quickrecon.co.zw'),
  ('EMP-012','Tinashe Kamwendo','Insurer','Insurance',24000,'on_leave','+263 77 234 5678','tinashe@quickrecon.co.zw')
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
