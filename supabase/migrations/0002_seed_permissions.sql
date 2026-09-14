-- Seed: permission catalogue + default role grants (mirrors lib/auth/permissions.ts)

insert into public.permissions (key, description) values
  ('agents.view', 'View agents'),
  ('agents.create', 'Create agents'),
  ('agents.edit', 'Edit agents'),
  ('agents.suspend', 'Suspend agents'),
  ('agents.manage_modules', 'Enable/suspend modules per agent'),
  ('agents.manage_booths', 'Manage agent booths'),
  ('assistants.view', 'View assistants'),
  ('assistants.approve', 'Approve assistants'),
  ('assistants.reject', 'Reject assistants'),
  ('imports.create', 'Upload company workbooks'),
  ('imports.preview', 'Inspect workbook contents'),
  ('imports.process', 'Process staged imports'),
  ('imports.delete', 'Archive imports'),
  ('reconciliation.view', 'View own reconciliation'),
  ('reconciliation.view_all', 'View all reconciliations'),
  ('reconciliation.process', 'Run reconciliation'),
  ('reconciliation.resolve_exceptions', 'Resolve exceptions'),
  ('reconciliation.approve', 'Approve reconciliation'),
  ('reconciliation.publish', 'Publish reconciliation'),
  ('reconciliation.adjust', 'Manual adjustments'),
  ('reports.view', 'View reports'),
  ('reports.export', 'Export reports'),
  ('reports.send', 'Distribute reports'),
  ('submissions.view', 'View submissions'),
  ('submissions.review', 'Review submissions'),
  ('communications.send', 'Send communications'),
  ('communications.schedule', 'Schedule communications'),
  ('users.view', 'View users'),
  ('users.create', 'Create users'),
  ('users.edit', 'Edit users'),
  ('users.permissions', 'Manage permissions'),
  ('settings.manage', 'Manage settings'),
  ('audit.view', 'View audit logs'),
  ('support.view', 'View support tickets'),
  ('support.manage', 'Manage support tickets')
on conflict (key) do nothing;

-- Super admin: everything.
insert into public.role_permissions (role, permission)
select 'super_admin', key from public.permissions
on conflict do nothing;

-- Admin default set.
insert into public.role_permissions (role, permission) values
  ('admin', 'agents.view'),
  ('admin', 'agents.edit'),
  ('admin', 'assistants.view'),
  ('admin', 'imports.preview'),
  ('admin', 'reconciliation.view'),
  ('admin', 'reconciliation.view_all'),
  ('admin', 'reconciliation.resolve_exceptions'),
  ('admin', 'reports.view'),
  ('admin', 'reports.export'),
  ('admin', 'reports.send'),
  ('admin', 'submissions.view'),
  ('admin', 'submissions.review'),
  ('admin', 'communications.send'),
  ('admin', 'users.view'),
  ('admin', 'audit.view'),
  ('admin', 'support.view')
on conflict do nothing;

-- Agent.
insert into public.role_permissions (role, permission) values
  ('agent', 'reconciliation.view'),
  ('agent', 'reports.view'),
  ('agent', 'reports.export'),
  ('agent', 'submissions.view'),
  ('agent', 'support.view')
on conflict do nothing;

-- Assistant (tighter than agent).
insert into public.role_permissions (role, permission) values
  ('assistant', 'reconciliation.view'),
  ('assistant', 'reports.view'),
  ('assistant', 'submissions.view'),
  ('assistant', 'support.view')
on conflict do nothing;

-- Tech support: diagnostics without financial authority.
insert into public.role_permissions (role, permission) values
  ('tech_support', 'agents.view'),
  ('tech_support', 'imports.preview'),
  ('tech_support', 'reconciliation.view'),
  ('tech_support', 'reports.view'),
  ('tech_support', 'users.view'),
  ('tech_support', 'audit.view'),
  ('tech_support', 'support.view'),
  ('tech_support', 'support.manage')
on conflict do nothing;
