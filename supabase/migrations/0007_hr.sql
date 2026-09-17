-- ============================================================================
-- 0007_hr.sql — HR records: welfare, leave, loans, sick notes, timecards,
-- banking details, KYC. One table, type + JSONB payload keeps it flexible.
-- ============================================================================

create table public.hr_records (
  id text primary key,                          -- HR-XXXX
  type text not null check (type in (
    'welfare','leave','loan','sick_note','timecard','banking','kyc'
  )),
  staff_id text not null,                       -- EMP-XXX or AGT-XXX
  staff_name text not null,
  payload jsonb not null default '{}'::jsonb,   -- type-specific fields
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','active','closed')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.hr_records (type);
create index on public.hr_records (staff_id);
create index on public.hr_records (status);
create index on public.hr_records (created_at desc);

alter table public.hr_records enable row level security;
create policy "hr_records_company" on public.hr_records for all
  using (public.is_company_user())
  with check (public.is_company_user());
