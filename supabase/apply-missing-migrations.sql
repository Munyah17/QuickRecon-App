-- ============================================================================
-- APPLY-ONCE: pending QuickRecon migrations (0005–0011)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Open https://supabase.com/dashboard/project/tmqwqmtbcsjdtyksiatw/sql
--      (the ref MUST be tmqwqmtbcsjdtyksiatw — the QuickRecon database).
--   2. Paste this entire file into a new query and press Run.
--   3. Done — the NOTIFY at the bottom reloads PostgREST's schema cache so the
--      new tables are queryable immediately (no more "not found in schema
--      cache" errors for erp_documents, staff, tasks, etc.).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT DO NOTHING / DROP TRIGGER IF EXISTS).
-- ============================================================================

-- ═══ 0005_tasks ════════════════════════════════════════════════════════════
create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed')),
  due_date date,
  assignee_type text not null
    check (assignee_type in ('agent','staff')),
  assignee_id text not null,
  assignee_name text not null,
  assignee_phone text,
  assignee_email text,
  shared boolean not null default false,
  milestones jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_type, assignee_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_created_idx on public.tasks (created_at desc);

alter table public.tasks enable row level security;

create or replace function public.is_task_assignee(t public.tasks)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when t.assignee_type = 'agent' then t.assignee_id = public.current_agent_id()
    else t.assignee_id = auth.uid()::text
  end;
$$;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select using (
  public.is_task_assignee(tasks.*)
  or (public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin')))
);
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_company_user());
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update using (
  public.is_task_assignee(tasks.*)
  or (public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin')))
);
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete using (
  public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin'))
);

-- ═══ 0006_erp ══════════════════════════════════════════════════════════════
create table if not exists public.erp_transactions (
  id text primary key,
  txn_date date not null,
  description text not null,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists erp_transactions_date_idx on public.erp_transactions (txn_date desc);

alter table public.erp_transactions enable row level security;
drop policy if exists "erp_txn_company" on public.erp_transactions;
create policy "erp_txn_company" on public.erp_transactions for all
  using (public.is_company_user())
  with check (public.is_company_user());

create table if not exists public.erp_requisitions (
  id text primary key,
  title text not null,
  requested_by text not null,
  department text,
  amount numeric,
  description text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  file_name text,
  file_path text,
  file_type text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists erp_requisitions_status_idx on public.erp_requisitions (status);
create index if not exists erp_requisitions_created_idx on public.erp_requisitions (created_at desc);

alter table public.erp_requisitions enable row level security;
drop policy if exists "erp_req_company" on public.erp_requisitions;
create policy "erp_req_company" on public.erp_requisitions for all
  using (public.is_company_user())
  with check (public.is_company_user());

insert into storage.buckets (id, name, public)
values ('requisitions', 'requisitions', false)
on conflict (id) do nothing;

drop policy if exists "req_files_company_read" on storage.objects;
create policy "req_files_company_read" on storage.objects for select
  using (bucket_id = 'requisitions' and public.is_company_user());
drop policy if exists "req_files_company_write" on storage.objects;
create policy "req_files_company_write" on storage.objects for insert
  with check (bucket_id = 'requisitions' and public.is_company_user());

-- ═══ 0007_hr ═══════════════════════════════════════════════════════════════
create table if not exists public.hr_records (
  id text primary key,
  type text not null check (type in (
    'welfare','leave','loan','sick_note','timecard','banking','kyc'
  )),
  staff_id text not null,
  staff_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','active','closed')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists hr_records_type_idx on public.hr_records (type);
create index if not exists hr_records_staff_idx on public.hr_records (staff_id);
create index if not exists hr_records_status_idx on public.hr_records (status);
create index if not exists hr_records_created_idx on public.hr_records (created_at desc);

alter table public.hr_records enable row level security;
drop policy if exists "hr_records_company" on public.hr_records;
create policy "hr_records_company" on public.hr_records for all
  using (public.is_company_user())
  with check (public.is_company_user());

-- ═══ 0008_profiles_contact ═════════════════════════════════════════════════
alter table public.profiles
  add column if not exists national_id text,
  add column if not exists phone text,
  add column if not exists location text;

-- ═══ 0009_staff_payment_methods ════════════════════════════════════════════
create table if not exists public.staff (
  id text primary key,
  full_name text not null,
  job_title text,
  department text,
  salary numeric(14,2) not null default 0,
  status user_status not null default 'active',
  phone text,
  email text,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_status_idx on public.staff (status);
create index if not exists staff_department_idx on public.staff (department);

alter table public.staff enable row level security;
drop policy if exists "staff_company" on public.staff;
create policy "staff_company" on public.staff for all
  using (public.is_company_user())
  with check (public.is_company_user());

create table if not exists public.payment_methods (
  id bigint generated always as identity primary key,
  owner_type text not null check (owner_type in ('staff','agent')),
  owner_id text not null,
  kind text not null check (kind in ('bank','mobile_money','other')),
  label text,
  bank_name text,
  branch_code text,
  account_name text,
  account_number text,
  provider text,
  mobile_number text,
  currency text not null default 'USD',
  is_primary boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_methods_owner_idx on public.payment_methods (owner_type, owner_id);
create index if not exists payment_methods_owner_id_idx on public.payment_methods (owner_id);

alter table public.payment_methods enable row level security;
drop policy if exists "payment_methods_company" on public.payment_methods;
create policy "payment_methods_company" on public.payment_methods for all
  using (public.is_company_user())
  with check (public.is_company_user());
drop policy if exists "payment_methods_agent_read_own" on public.payment_methods;
create policy "payment_methods_agent_read_own" on public.payment_methods for select
  using (owner_type = 'agent' and owner_id = public.current_agent_id());

-- ═══ 0010_erp_documents ════════════════════════════════════════════════════
create table if not exists public.erp_documents (
  id            text primary key,
  kind          text not null check (kind in ('invoice','quotation')),
  client        text not null,
  client_contact text,
  client_address text,
  client_email  text,
  client_phone  text,
  po_number     text,
  amount        numeric(14,2) not null default 0,
  currency      text not null default 'ZWG',
  doc_date      date not null default current_date,
  due_date      date,
  valid_until   date,
  status        text not null default 'draft'
                check (status in ('draft','pending','sent','paid','overdue','accepted','declined')),
  vat_rate      numeric(6,4),
  discount_pct  numeric(6,2),
  amount_paid   numeric(14,2) not null default 0,
  notes         text,
  lines         jsonb not null default '[]'::jsonb,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists erp_documents_kind_idx   on public.erp_documents (kind);
create index if not exists erp_documents_status_idx on public.erp_documents (status);

alter table public.erp_documents enable row level security;
drop policy if exists "erp_documents_company_all" on public.erp_documents;
create policy "erp_documents_company_all"
  on public.erp_documents
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','finance','operations','tech_support')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','finance','operations','tech_support')
    )
  );

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists erp_documents_updated_at on public.erp_documents;
create trigger erp_documents_updated_at
  before update on public.erp_documents
  for each row execute function public.set_updated_at();

-- ═══ 0011_role_normalisation ═══════════════════════════════════════════════
update public.profiles
set role = case role::text
  when 'superadmin' then 'super_admin'
  when 'super admin' then 'super_admin'
  when 'administrator' then 'admin'
  when 'customer' then 'agent'
  else 'agent'
end
where role::text not in ('super_admin', 'admin', 'agent', 'assistant', 'tech_support');

create or replace function public.current_role()
returns role_code language sql stable security definer set search_path = public as $$
  select case (select role::text from public.profiles where id = auth.uid())
    when 'super_admin' then 'super_admin'::role_code
    when 'superadmin' then 'super_admin'::role_code
    when 'admin' then 'admin'::role_code
    when 'administrator' then 'admin'::role_code
    when 'assistant' then 'assistant'::role_code
    when 'tech_support' then 'tech_support'::role_code
    else 'agent'::role_code
  end;
$$;

create or replace function public.is_company_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('super_admin', 'admin', 'tech_support');
$$;

-- ═══ Reload PostgREST schema cache — tables become queryable NOW ═══════════
notify pgrst, 'reload schema';
