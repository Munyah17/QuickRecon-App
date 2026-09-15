-- Generated per-agent reconciliation documents + delivery audit trail.
-- These back the /api/reconciliation/generate and /api/reconciliation/send
-- routes and let agents read ONLY their own published document.

alter table public.agents
  add column if not exists opening_position numeric(16,2) not null default 0;

create table public.reconciliation_documents (
  id bigint generated always as identity primary key,
  batch_id text not null references public.reconciliation_batches (id) on delete cascade,
  agent_id text not null references public.agents (id),
  agent_name text not null,
  module module_code not null,
  period text not null,
  currency currency_code not null default 'ZWG',
  opening_variance numeric(16,2) not null default 0,
  insurance numeric(16,2) not null default 0,
  premium_cover numeric(16,2) not null default 0,
  commission numeric(16,2) not null default 0,
  net_insurance numeric(16,2) not null default 0,
  zinara numeric(16,2) not null default 0,
  pds numeric(16,2) not null default 0,
  total_expected numeric(16,2) not null default 0,
  bank_deposits jsonb not null default '{}'::jsonb,
  deposits numeric(16,2) not null default 0,
  adjustments numeric(16,2) not null default 0,
  closing_variance numeric(16,2) not null default 0,
  closing_position numeric(16,2) not null default 0,
  status text not null default 'warning',
  transactions jsonb not null default '[]'::jsonb,
  summary_text text not null default '',
  csv_text text,
  created_at timestamptz not null default now(),
  unique (batch_id, agent_id)
);
create index on public.reconciliation_documents (agent_id, period);

create table public.reconciliation_deliveries (
  id bigint generated always as identity primary key,
  batch_id text not null references public.reconciliation_batches (id) on delete cascade,
  agent_id text not null references public.agents (id),
  channels text[] not null default '{}',
  status text not null default 'sent',      -- sent | partial | failed
  delivered_by uuid references public.profiles (id),
  delivered_at timestamptz not null default now()
);
create index on public.reconciliation_deliveries (batch_id);

alter table public.reconciliation_documents enable row level security;
alter table public.reconciliation_deliveries enable row level security;

-- Company users manage everything; agents read only their own rows.
create policy "recon_docs_company_all" on public.reconciliation_documents
  for all using (public.is_company_user()) with check (public.is_company_user());
create policy "recon_docs_agent_read" on public.reconciliation_documents
  for select using (agent_id = public.current_agent_id());

create policy "recon_deliveries_company_all" on public.reconciliation_deliveries
  for all using (public.is_company_user()) with check (public.is_company_user());
create policy "recon_deliveries_agent_read" on public.reconciliation_deliveries
  for select using (agent_id = public.current_agent_id());
