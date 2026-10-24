-- Restore missing baseline access policies without replacing existing policies.
-- Hosted deployments created outside the migration runner may have RLS enabled
-- but no staff/profile policies, causing valid logins to appear profile-less.
-- This migration does not disable RLS or alter account roles/passwords.

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_self'
  ) then
    create policy "profiles_select_self"  on public.profiles for select using (id = auth.uid() or public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_self'
  ) then
    create policy "profiles_update_self"  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role() and agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_admin_write'
  ) then
    create policy "profiles_admin_write"  on public.profiles for all using (public.current_role() = 'super_admin') with check (public.current_role() = 'super_admin');
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents' and policyname = 'agents_company_read'
  ) then
    create policy "agents_company_read" on public.agents for select using (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents' and policyname = 'agents_self_read'
  ) then
    create policy "agents_self_read"    on public.agents for select using (id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booths' and policyname = 'booths_company'
  ) then
    create policy "booths_company" on public.booths for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booths' and policyname = 'booths_owner_read'
  ) then
    create policy "booths_owner_read" on public.booths for select using (agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'import_batches' and policyname = 'imports_company'
  ) then
    create policy "imports_company" on public.import_batches for all using (public.current_role() in ('super_admin','admin') or (public.current_role() = 'tech_support' and false)) with check (public.current_role() in ('super_admin','admin'));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staging_rows' and policyname = 'staging_company'
  ) then
    create policy "staging_company" on public.staging_rows for all using (public.current_role() in ('super_admin','admin')) with check (public.current_role() in ('super_admin','admin'));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'normalised_records' and policyname = 'normalised_company'
  ) then
    create policy "normalised_company" on public.normalised_records for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliations' and policyname = 'recon_company'
  ) then
    create policy "recon_company" on public.reconciliations for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliations' and policyname = 'recon_self_read'
  ) then
    create policy "recon_self_read" on public.reconciliations for select using (agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_lines' and policyname = 'recon_lines_company'
  ) then
    create policy "recon_lines_company" on public.reconciliation_lines for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_lines' and policyname = 'recon_lines_self_read'
  ) then
    create policy "recon_lines_self_read" on public.reconciliation_lines for select using (
  exists (select 1 from public.reconciliations r where r.id = reconciliation_id and r.agent_id = public.current_agent_id())
);
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_versions' and policyname = 'recon_versions_read'
  ) then
    create policy "recon_versions_read" on public.reconciliation_versions for select using (public.is_company_user() or exists (
  select 1 from public.reconciliations r where r.id = reconciliation_id and r.agent_id = public.current_agent_id()));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_exceptions' and policyname = 'exceptions_company'
  ) then
    create policy "exceptions_company" on public.reconciliation_exceptions for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_adjustments' and policyname = 'adjustments_company'
  ) then
    create policy "adjustments_company" on public.reconciliation_adjustments for all using (public.current_role() in ('super_admin','admin')) with check (public.current_role() in ('super_admin','admin'));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_discrepancies' and policyname = 'discrepancies_self_write'
  ) then
    create policy "discrepancies_self_write" on public.agent_discrepancies for insert with check (agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_discrepancies' and policyname = 'discrepancies_self_read'
  ) then
    create policy "discrepancies_self_read" on public.agent_discrepancies for select using (agent_id = public.current_agent_id() or public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_discrepancies' and policyname = 'discrepancies_company_update'
  ) then
    create policy "discrepancies_company_update" on public.agent_discrepancies for update using (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_self_read'
  ) then
    create policy "reports_self_read" on public.reports for select using (agent_id = public.current_agent_id() or public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_company_write'
  ) then
    create policy "reports_company_write" on public.reports for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions' and policyname = 'submissions_self'
  ) then
    create policy "submissions_self" on public.submissions for select using (agent_id = public.current_agent_id() or public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions' and policyname = 'submissions_agent_insert'
  ) then
    create policy "submissions_agent_insert" on public.submissions for insert with check (agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions' and policyname = 'submissions_company_update'
  ) then
    create policy "submissions_company_update" on public.submissions for update using (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'tickets_self'
  ) then
    create policy "tickets_self" on public.support_tickets for select using (agent_id = public.current_agent_id() or public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'tickets_agent_insert'
  ) then
    create policy "tickets_agent_insert" on public.support_tickets for insert with check (agent_id = public.current_agent_id() or true);
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'tickets_company_update'
  ) then
    create policy "tickets_company_update" on public.support_tickets for update using (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_owner'
  ) then
    create policy "notifications_owner" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'audit_read_company'
  ) then
    create policy "audit_read_company" on public.audit_logs for select using (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_external_ids' and policyname = 'extids_read'
  ) then
    create policy "extids_read" on public.agent_external_ids for select using (public.is_company_user() or agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_external_ids' and policyname = 'extids_company_write'
  ) then
    create policy "extids_company_write" on public.agent_external_ids for all using (public.is_company_user()) with check (public.is_company_user());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_modules' and policyname = 'agent_modules_read'
  ) then
    create policy "agent_modules_read" on public.agent_modules for select using (public.is_company_user() or agent_id = public.current_agent_id());
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_modules' and policyname = 'agent_modules_company_write'
  ) then
    create policy "agent_modules_company_write" on public.agent_modules for all using (public.current_role() = 'super_admin') with check (public.current_role() = 'super_admin');
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_storage_company'
  ) then
    create policy "imports_storage_company" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.current_role() in ('super_admin','admin'));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_storage_read'
  ) then
    create policy "imports_storage_read" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.current_role() in ('super_admin','admin'));
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'submissions_storage'
  ) then
    create policy "submissions_storage" on storage.objects for all to authenticated
  using (bucket_id = 'submissions') with check (bucket_id = 'submissions');
  end if;
end
$restore_policy$;

do $restore_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'reports_storage'
  ) then
    create policy "reports_storage" on storage.objects for select to authenticated
  using (bucket_id = 'reports');
  end if;
end
$restore_policy$;
