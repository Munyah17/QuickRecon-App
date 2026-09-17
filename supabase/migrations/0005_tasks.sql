-- ============================================================================
-- 0005_tasks.sql — Task Management with milestones & assignment
-- ============================================================================
-- Tasks can be assigned to staff (profiles) or field users (agents).
-- "Shared" tasks are visible only to super_admin/admin and the assignee.
-- Milestones are stored as a jsonb array:
--   [{ "id": "m1", "title": "…", "done": false, "doneAt": null }, …]
-- ============================================================================

create table public.tasks (
  id text primary key,                          -- TSK-0001
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed')),
  due_date date,
  assignee_type text not null
    check (assignee_type in ('agent','staff')),
  assignee_id text not null,                    -- agents.id or profiles.id::text
  assignee_name text not null,
  assignee_phone text,
  assignee_email text,
  shared boolean not null default false,
  milestones jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index on public.tasks (assignee_type, assignee_id);
create index on public.tasks (status);
create index on public.tasks (created_at desc);

alter table public.tasks enable row level security;

-- Helper: is the current user the assignee of a task row?
create or replace function public.is_task_assignee(t public.tasks)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when t.assignee_type = 'agent' then t.assignee_id = public.current_agent_id()
    else t.assignee_id = auth.uid()::text
  end;
$$;

-- Company roles read everything; field users read only tasks assigned to them.
-- Shared tasks are hidden from non-admin company roles unless assigned.
create policy "tasks_select" on public.tasks for select using (
  public.is_task_assignee(tasks.*)
  or (public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin')))
);

-- Only company roles create tasks.
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_company_user());

-- Assignee may update their own task (milestone progress); company roles may
-- update anything they can see.
create policy "tasks_update" on public.tasks for update using (
  public.is_task_assignee(tasks.*)
  or (public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin')))
);

create policy "tasks_delete" on public.tasks for delete using (
  public.is_company_user() and (not shared or public.current_role() in ('super_admin','admin'))
);
