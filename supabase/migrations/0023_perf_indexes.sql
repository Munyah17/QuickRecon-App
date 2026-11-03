-- ---------------------------------------------------------------------------
-- 0023_perf_indexes.sql — indexes for the dashboard's hot read paths
--
-- Every layout render sorts notifications and audit_logs by created_at; the
-- reconciliation queue scans documents/exceptions; the run cycle pages
-- staging_rows by batch. All of those were sequential scans.
--
-- Idempotent: safe to run repeatedly or paste into the Supabase SQL editor.
-- ---------------------------------------------------------------------------

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists reconciliation_documents_created_at_idx
  on public.reconciliation_documents (created_at desc);

create index if not exists reconciliation_exceptions_created_at_idx
  on public.reconciliation_exceptions (created_at desc);

-- The queue badge + summary counts filter open exceptions constantly.
create index if not exists reconciliation_exceptions_open_idx
  on public.reconciliation_exceptions (status) where status = 'open';

create index if not exists reconciliations_period_idx
  on public.reconciliations (period desc);

create index if not exists reconciliations_agent_idx
  on public.reconciliations (agent_id);

-- Run-cycle pages staging_rows by (batch_id, worksheet, row_number).
create index if not exists staging_rows_batch_sheet_row_idx
  on public.staging_rows (batch_id, worksheet, row_number);

create index if not exists import_worksheets_batch_idx
  on public.import_worksheets (batch_id);

create index if not exists import_batches_module_period_idx
  on public.import_batches (module, period);

-- Reload PostgREST's schema cache so the change is visible immediately.
notify pgrst, 'reload schema';
