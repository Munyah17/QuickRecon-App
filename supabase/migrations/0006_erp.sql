-- ============================================================================
-- 0006_erp.sql — ERP accounting transactions + requisitions (with file upload)
-- ============================================================================

create table public.erp_transactions (
  id text primary key,                          -- TXN-XXXX
  txn_date date not null,
  description text not null,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.erp_transactions (txn_date desc);

alter table public.erp_transactions enable row level security;
create policy "erp_txn_company" on public.erp_transactions for all
  using (public.is_company_user())
  with check (public.is_company_user());

create table public.erp_requisitions (
  id text primary key,                          -- REQ-XXXX
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
create index on public.erp_requisitions (status);
create index on public.erp_requisitions (created_at desc);

alter table public.erp_requisitions enable row level security;
create policy "erp_req_company" on public.erp_requisitions for all
  using (public.is_company_user())
  with check (public.is_company_user());

-- Private bucket for requisition attachments (pdf, docx, xlsx, txt, images).
insert into storage.buckets (id, name, public)
values ('requisitions', 'requisitions', false)
on conflict (id) do nothing;

create policy "req_files_company_read" on storage.objects for select
  using (bucket_id = 'requisitions' and public.is_company_user());
create policy "req_files_company_write" on storage.objects for insert
  with check (bucket_id = 'requisitions' and public.is_company_user());
