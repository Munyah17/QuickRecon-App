-- ============================================================================
-- QuickRecon App — initial schema, roles, RLS
-- Agent Management + Reconciliation ERP (Enpassent / Econet Moovah)
-- ============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
create type role_code as enum ('super_admin', 'admin', 'agent', 'assistant', 'tech_support');
create type module_code as enum ('enpassent', 'econet-moovah');
create type user_status as enum ('active', 'suspended', 'pending', 'inactive');
create type recon_status as enum ('processing', 'review', 'success', 'warning', 'attention', 'approved', 'published');
create type exception_severity as enum ('critical', 'high', 'medium', 'low');
create type exception_status as enum ('open', 'investigating', 'resolved', 'ignored');
create type submission_status as enum ('pending', 'under_review', 'completed', 'rejected');
create type currency_code as enum ('ZWG', 'USD');

-- --------------------------------------------------------------------------
-- Identity & access
-- --------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role role_code not null default 'agent',
  status user_status not null default 'active',
  agent_id text,
  parent_agent_id text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  description text
);

create table public.role_permissions (
  role role_code not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- --------------------------------------------------------------------------
-- Agents / booths / assistants / external identities / module access
-- --------------------------------------------------------------------------
create table public.agents (
  id text primary key,                    -- AGT-000184
  user_id uuid references public.profiles (id),
  full_name text not null,
  email text not null,
  phone text,
  province text,
  location text,
  status user_status not null default 'active',
  national_id text,
  icecash_id text,
  kyc_status text not null default 'pending',
  joined_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.agent_external_ids (
  id bigint generated always as identity primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  scheme text not null,                   -- enpassent_user_id, econet_id, icecash_id…
  value text not null,
  unique (scheme, value)
);
create index on public.agent_external_ids (value);

create table public.agent_modules (
  agent_id text not null references public.agents (id) on delete cascade,
  module module_code not null,
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (agent_id, module)
);

create table public.booths (
  id text primary key,                    -- BTH-0101
  agent_id text not null references public.agents (id) on delete cascade,
  name text not null,
  location text,
  province text,
  status user_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on public.booths (agent_id);

create table public.booth_modules (
  booth_id text not null references public.booths (id) on delete cascade,
  module module_code not null,
  primary key (booth_id, module)
);

create table public.assistants (
  id text primary key,                    -- AST-0011
  agent_id text not null references public.agents (id) on delete cascade,
  booth_id text references public.booths (id),
  user_id uuid references public.profiles (id),
  full_name text not null,
  email text,
  phone text,
  status user_status not null default 'pending',
  requested_permissions text[] not null default '{}',
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.assistants (agent_id);

-- --------------------------------------------------------------------------
-- Import pipeline (source → staging → normalised → matched)
-- --------------------------------------------------------------------------
create table public.import_batches (
  id text primary key,                    -- IMP-2608-01
  module module_code not null,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  file_name text not null,
  storage_path text,
  file_size bigint,
  checksum text,
  status text not null default 'uploaded',
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.import_worksheets (
  id bigint generated always as identity primary key,
  batch_id text not null references public.import_batches (id) on delete cascade,
  name text not null,
  row_count integer not null default 0,
  column_count integer not null default 0,
  headers jsonb not null default '[]',
  selected boolean not null default true,
  warnings jsonb not null default '[]'
);

create table public.staging_rows (
  id bigint generated always as identity primary key,
  batch_id text not null references public.import_batches (id) on delete cascade,
  worksheet text not null,
  row_number integer not null,
  raw jsonb not null
);
create index on public.staging_rows (batch_id);

create table public.normalised_records (
  id bigint generated always as identity primary key,
  batch_id text not null references public.import_batches (id) on delete cascade,
  staging_row_id bigint references public.staging_rows (id) on delete set null,
  agent_id text references public.agents (id),
  external_id text,
  category text not null check (category in ('insurance', 'zinara', 'deposit', 'adjustment')),
  amount numeric(16,2) not null,
  currency currency_code not null default 'ZWG',
  reference text,
  txn_date date,
  matched boolean not null default false
);
create index on public.normalised_records (batch_id, agent_id);
create index on public.normalised_records (reference);

-- --------------------------------------------------------------------------
-- Reconciliation
-- --------------------------------------------------------------------------
create table public.reconciliation_batches (
  id text primary key,
  module module_code not null,
  period text not null,
  import_batch_id text references public.import_batches (id),
  status recon_status not null default 'processing',
  created_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reconciliations (
  id text primary key,                    -- RCN-2608-001
  batch_id text not null references public.reconciliation_batches (id) on delete cascade,
  agent_id text not null references public.agents (id),
  module module_code not null,
  period text not null,
  status recon_status not null default 'processing',
  currency currency_code not null default 'ZWG',
  opening_position numeric(16,2) not null default 0,
  insurance numeric(16,2) not null default 0,
  zinara numeric(16,2) not null default 0,
  deposits numeric(16,2) not null default 0,
  adjustments numeric(16,2) not null default 0,
  closing_position numeric(16,2) not null default 0,
  version integer not null default 1,
  published_at timestamptz
);
create index on public.reconciliations (agent_id, period);

create table public.reconciliation_lines (
  id bigint generated always as identity primary key,
  reconciliation_id text not null references public.reconciliations (id) on delete cascade,
  item text not null,
  category text not null,
  expected numeric(16,2) not null,
  actual numeric(16,2) not null,
  variance numeric(16,2) not null default 0,
  status text not null default 'matched'
);

-- Immutable published snapshots (never rewrite published numbers)
create table public.reconciliation_versions (
  id bigint generated always as identity primary key,
  reconciliation_id text not null references public.reconciliations (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  published_by uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  unique (reconciliation_id, version)
);

create table public.reconciliation_adjustments (
  id bigint generated always as identity primary key,
  reconciliation_id text not null references public.reconciliations (id) on delete cascade,
  amount numeric(16,2) not null,
  reason text not null,
  supporting_note text,
  created_by uuid not null references public.profiles (id),
  approved_by uuid references public.profiles (id),
  before_closing numeric(16,2) not null,
  after_closing numeric(16,2) not null,
  created_at timestamptz not null default now()
);

create table public.reconciliation_exceptions (
  id text primary key,                    -- EXC-4001
  batch_id text references public.reconciliation_batches (id) on delete set null,
  import_batch_id text references public.import_batches (id) on delete set null,
  module module_code not null,
  agent_id text references public.agents (id),
  type text not null,
  severity exception_severity not null default 'medium',
  source_ref text,
  description text not null,
  status exception_status not null default 'open',
  resolution text,
  assignee uuid references public.profiles (id),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reconciliation_exceptions (status, severity);

create table public.agent_discrepancies (
  id bigint generated always as identity primary key,
  reconciliation_id text not null references public.reconciliations (id) on delete cascade,
  agent_id text not null references public.agents (id),
  item_ref text,
  note text not null,
  attachments jsonb not null default '[]',
  status text not null default 'submitted',
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- --------------------------------------------------------------------------
-- Reports / distribution
-- --------------------------------------------------------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  reconciliation_id text references public.reconciliations (id),
  module module_code not null,
  period text not null,
  type text not null,
  title text not null,
  storage_path text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.distribution_jobs (
  id text primary key,
  period text not null,
  module text not null,
  channels text[] not null default '{email}',
  message text,
  status text not null default 'scheduled',
  scheduled_for timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.distribution_recipients (
  id bigint generated always as identity primary key,
  job_id text not null references public.distribution_jobs (id) on delete cascade,
  agent_id text not null references public.agents (id),
  channel text not null,
  address text not null,
  provider_message_id text,
  status text not null default 'queued',
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text
);

-- --------------------------------------------------------------------------
-- Submissions / support / notifications / audit
-- --------------------------------------------------------------------------
create table public.submissions (
  id text primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  module module_code not null,
  type text not null,
  title text not null,
  description text,
  status submission_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.submission_files (
  id bigint generated always as identity primary key,
  submission_id text not null references public.submissions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id text primary key,
  agent_id text references public.agents (id),
  created_by uuid not null references public.profiles (id),
  module module_code,
  category text not null,
  subject text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read);

-- Append-oriented audit trail
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  previous jsonb,
  next jsonb,
  module module_code,
  metadata jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (entity, entity_id);
create index on public.audit_logs (created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_external_ids enable row level security;
alter table public.agent_modules enable row level security;
alter table public.booths enable row level security;
alter table public.assistants enable row level security;
alter table public.import_batches enable row level security;
alter table public.staging_rows enable row level security;
alter table public.normalised_records enable row level security;
alter table public.reconciliations enable row level security;
alter table public.reconciliation_lines enable row level security;
alter table public.reconciliation_versions enable row level security;
alter table public.reconciliation_exceptions enable row level security;
alter table public.reconciliation_adjustments enable row level security;
alter table public.agent_discrepancies enable row level security;
alter table public.reports enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: role of the caller
create or replace function public.current_role()
returns role_code language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_agent_id()
returns text language sql stable security definer set search_path = public as $$
  select agent_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_company_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','admin','tech_support') from public.profiles where id = auth.uid()), false);
$$;

-- Profiles: self-read; company roles read all; only super_admin edits others.
create policy "profiles_select_self"  on public.profiles for select using (id = auth.uid() or public.is_company_user());
create policy "profiles_update_self"  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role() and agent_id = public.current_agent_id());
create policy "profiles_admin_write"  on public.profiles for all using (public.current_role() = 'super_admin') with check (public.current_role() = 'super_admin');

-- Agents: company roles read all; an agent reads only own row. No agent-side writes for protected columns.
create policy "agents_company_read" on public.agents for select using (public.is_company_user());
create policy "agents_self_read"    on public.agents for select using (id = public.current_agent_id());

-- Booths: company all; agent owns booth via agent_id.
create policy "booths_company" on public.booths for all using (public.is_company_user()) with check (public.is_company_user());
create policy "booths_owner_read" on public.booths for select using (agent_id = public.current_agent_id());

-- Assistants: only parent agent (and company) ever see an assistant row.
create policy "assistants_company" on public.assistants for all using (public.is_company_user()) with check (public.is_company_user());
create policy "assistants_parent" on public.assistants for select using (agent_id = public.current_agent_id());

-- Import pipeline & reconciliation: company-only writes; agent reads ONLY own reconciliations.
create policy "imports_company" on public.import_batches for all using (public.current_role() in ('super_admin','admin') or (public.current_role() = 'tech_support' and false)) with check (public.current_role() in ('super_admin','admin'));
create policy "staging_company" on public.staging_rows for all using (public.current_role() in ('super_admin','admin')) with check (public.current_role() in ('super_admin','admin'));
create policy "normalised_company" on public.normalised_records for all using (public.is_company_user()) with check (public.is_company_user());

create policy "recon_company" on public.reconciliations for all using (public.is_company_user()) with check (public.is_company_user());
create policy "recon_self_read" on public.reconciliations for select using (agent_id = public.current_agent_id());
create policy "recon_lines_company" on public.reconciliation_lines for all using (public.is_company_user()) with check (public.is_company_user());
create policy "recon_lines_self_read" on public.reconciliation_lines for select using (
  exists (select 1 from public.reconciliations r where r.id = reconciliation_id and r.agent_id = public.current_agent_id())
);
create policy "recon_versions_read" on public.reconciliation_versions for select using (public.is_company_user() or exists (
  select 1 from public.reconciliations r where r.id = reconciliation_id and r.agent_id = public.current_agent_id()));

-- Exceptions & adjustments are company-internal.
create policy "exceptions_company" on public.reconciliation_exceptions for all using (public.is_company_user()) with check (public.is_company_user());
create policy "adjustments_company" on public.reconciliation_adjustments for all using (public.current_role() in ('super_admin','admin')) with check (public.current_role() in ('super_admin','admin'));

-- Discrepancies: agent can create/read own; company reads all.
create policy "discrepancies_self_write" on public.agent_discrepancies for insert with check (agent_id = public.current_agent_id());
create policy "discrepancies_self_read" on public.agent_discrepancies for select using (agent_id = public.current_agent_id() or public.is_company_user());
create policy "discrepancies_company_update" on public.agent_discrepancies for update using (public.is_company_user());

-- Reports: agent reads own; company all.
create policy "reports_self_read" on public.reports for select using (agent_id = public.current_agent_id() or public.is_company_user());
create policy "reports_company_write" on public.reports for all using (public.is_company_user()) with check (public.is_company_user());

-- Submissions: agent creates/reads own; company reviews.
create policy "submissions_self" on public.submissions for select using (agent_id = public.current_agent_id() or public.is_company_user());
create policy "submissions_agent_insert" on public.submissions for insert with check (agent_id = public.current_agent_id());
create policy "submissions_company_update" on public.submissions for update using (public.is_company_user());

-- Tickets: same shape.
create policy "tickets_self" on public.support_tickets for select using (agent_id = public.current_agent_id() or public.is_company_user());
create policy "tickets_agent_insert" on public.support_tickets for insert with check (agent_id = public.current_agent_id() or true);
create policy "tickets_company_update" on public.support_tickets for update using (public.is_company_user());

-- Notifications: owner only.
create policy "notifications_owner" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit: read for company roles; writes happen through service role only.
create policy "audit_read_company" on public.audit_logs for select using (public.is_company_user());

-- External IDs & module access: never writable by agents.
create policy "extids_read" on public.agent_external_ids for select using (public.is_company_user() or agent_id = public.current_agent_id());
create policy "extids_company_write" on public.agent_external_ids for all using (public.is_company_user()) with check (public.is_company_user());
create policy "agent_modules_read" on public.agent_modules for select using (public.is_company_user() or agent_id = public.current_agent_id());
create policy "agent_modules_company_write" on public.agent_modules for all using (public.current_role() = 'super_admin') with check (public.current_role() = 'super_admin');

-- ============================================================================
-- Storage buckets (private; served via signed URLs)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('imports', 'imports', false),
  ('reports', 'reports', false),
  ('submissions', 'submissions', false),
  ('kyc', 'kyc', false)
on conflict (id) do nothing;

-- Only company users can put official import workbooks; agents cannot.
create policy "imports_storage_company" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.current_role() in ('super_admin','admin'));

create policy "imports_storage_read" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.current_role() in ('super_admin','admin'));

create policy "submissions_storage" on storage.objects for all to authenticated
  using (bucket_id = 'submissions') with check (bucket_id = 'submissions');

create policy "reports_storage" on storage.objects for select to authenticated
  using (bucket_id = 'reports');
