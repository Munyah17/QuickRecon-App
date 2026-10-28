-- 0015_decision_engine.sql
-- Persistence for the QuickRecon decision engine: every automatic decision
-- (exception triage/assignment, agent risk scoring, import anomaly detection)
-- is recorded so operators can trace *why* the engine acted.

-- ---------------------------------------------------------------------------
-- Exceptions gain engine assignment metadata. `assignee` already exists; the
-- engine fills it plus these two columns so staff can see it was automatic.
-- ---------------------------------------------------------------------------
alter table public.reconciliation_exceptions
  add column if not exists assigned_by_engine boolean not null default false,
  add column if not exists assignment_reason text;

-- ---------------------------------------------------------------------------
-- engine_decisions — the audit spine. One row per decision the engine makes.
-- ---------------------------------------------------------------------------
create table if not exists public.engine_decisions (
  id text primary key,                        -- DEC-…
  kind text not null                          -- exception_assignment | risk_score | import_anomaly
    check (kind in ('exception_assignment','risk_score','import_anomaly')),
  subject_type text not null,                 -- reconciliation_exceptions | agents | reconciliation_batches
  subject_id text not null,
  decision jsonb not null,                    -- the chosen action / computed value
  reasons jsonb not null default '[]'::jsonb, -- explainable inputs behind the choice
  status text not null default 'applied'
    check (status in ('applied','overridden','reverted')),
  created_at timestamptz not null default now()
);
create index if not exists engine_decisions_kind_created_idx on public.engine_decisions (kind, created_at desc);
create index if not exists engine_decisions_subject_idx on public.engine_decisions (subject_type, subject_id);
alter table public.engine_decisions enable row level security;
drop policy if exists "engine_decisions_company" on public.engine_decisions;
create policy "engine_decisions_company" on public.engine_decisions for all
  using (public.is_company_user()) with check (public.is_company_user());

-- ---------------------------------------------------------------------------
-- agent_risk_scores — one row per agent per module per period, upserted by the
-- engine after each processed batch.
-- ---------------------------------------------------------------------------
create table if not exists public.agent_risk_scores (
  id bigint generated always as identity primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  module module_code not null,
  period text not null,
  score integer not null check (score between 0 and 100),
  level text not null check (level in ('low','medium','high','critical')),
  factors jsonb not null default '[]'::jsonb, -- [{ factor, weight, detail }]
  computed_at timestamptz not null default now(),
  unique (agent_id, module, period)
);
create index if not exists agent_risk_scores_level_idx on public.agent_risk_scores (level, score desc);
alter table public.agent_risk_scores enable row level security;
drop policy if exists "agent_risk_company" on public.agent_risk_scores;
create policy "agent_risk_company" on public.agent_risk_scores for all
  using (public.is_company_user()) with check (public.is_company_user());

-- ---------------------------------------------------------------------------
-- import_anomalies — statistical findings that complement rule-based
-- exceptions. High-severity anomalies also raise reconciliation_exceptions.
-- ---------------------------------------------------------------------------
create table if not exists public.import_anomalies (
  id text primary key,                        -- ANO-…
  batch_id text references public.reconciliation_batches (id) on delete cascade,
  import_batch_id text references public.import_batches (id) on delete set null,
  module module_code not null,
  agent_id text references public.agents (id) on delete set null,
  kind text not null                          -- volume_outlier | deposit_ratio_low | zero_deposit_high_revenue | round_numbers | missing_agent
    check (kind in ('volume_outlier','deposit_ratio_low','zero_deposit_high_revenue','round_numbers','missing_agent')),
  severity exception_severity not null default 'medium',
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open','acknowledged','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists import_anomalies_batch_idx on public.import_anomalies (batch_id, severity);
alter table public.import_anomalies enable row level security;
drop policy if exists "import_anomalies_company" on public.import_anomalies;
create policy "import_anomalies_company" on public.import_anomalies for all
  using (public.is_company_user()) with check (public.is_company_user());
