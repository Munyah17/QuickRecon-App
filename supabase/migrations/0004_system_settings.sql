-- Key-value system settings (currency config, integrations, POS devices, …).
-- Single source of truth so settings never silently fall back to defaults.

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- All authenticated staff can read settings; only super_admin/admin write.
create policy "settings_read_company" on public.system_settings
  for select using (public.is_company_user());
create policy "settings_write_admin" on public.system_settings
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'admin')
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'admin')
    )
  );
