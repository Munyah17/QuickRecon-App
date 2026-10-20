-- Migration 0013: Communications log table
-- Tracks all sent messages (SMS, email, WhatsApp, in-app) for summary reporting

create type communication_channel as enum ('sms', 'email', 'whatsapp', 'in_app');

create type communication_status as enum ('pending', 'sent', 'failed', 'scheduled');

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  channel communication_channel not null,
  status communication_status not null default 'pending',
  recipient_count integer not null default 0,
  recipients text[] default array[]::text[],
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  scheduled_for timestamptz,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_communications_sent_by on public.communications(sent_by);
create index idx_communications_channel on public.communications(channel);
create index idx_communications_status on public.communications(status);
create index idx_communications_sent_at on public.communications(sent_at desc);
create index idx_communications_scheduled_for on public.communications(scheduled_for) where status = 'scheduled';

-- RLS: Only company staff can view communications
alter table public.communications enable row level security;

create policy "Company staff can view all communications"
  on public.communications for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('super_admin', 'admin', 'tech_support')
    )
  );

create policy "Company staff can insert communications"
  on public.communications for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('super_admin', 'admin', 'tech_support')
    )
  );

-- Service role bypasses RLS for automated updates
