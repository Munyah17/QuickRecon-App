-- 0010: erp_documents — real invoices & quotations (figures data).
-- Replaces the hardcoded mock array in the ERP Invoices tab so every
-- document, amount and status change is persisted and validated.

create table if not exists public.erp_documents (
  id            text primary key,                -- INV-2026-001 / QT-2026-001
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

-- Company staff (super_admin, admin, finance, operations) manage documents.
create policy "erp_documents_company_all"
  on public.erp_documents
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','finance','operations')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','finance','operations')
    )
  );

-- updated_at trigger
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
