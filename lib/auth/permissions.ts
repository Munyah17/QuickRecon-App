import type { RoleCode } from "@/types";

/**
 * Granular permission keys. Roles are collections of permissions;
 * Super Admin may further tailor privilege sets per user.
 * Enforcement happens at the database (RLS) AND server layer —
 * UI gating is convenience only, never security.
 */
export const PERMISSIONS = {
  agents: [
    "agents.view",
    "agents.create",
    "agents.edit",
    "agents.suspend",
    "agents.manage_modules",
    "agents.manage_booths",
  ],
  assistants: ["assistants.view", "assistants.approve", "assistants.reject"],
  imports: [
    "imports.create",
    "imports.preview",
    "imports.process",
    "imports.delete",
  ],
  reconciliation: [
    "reconciliation.view",
    "reconciliation.view_all",
    "reconciliation.process",
    "reconciliation.resolve_exceptions",
    "reconciliation.approve",
    "reconciliation.publish",
    "reconciliation.adjust",
  ],
  reports: ["reports.view", "reports.export", "reports.send"],
  submissions: ["submissions.view", "submissions.review"],
  communications: ["communications.send", "communications.schedule"],
  users: ["users.view", "users.create", "users.edit", "users.permissions"],
  settings: ["settings.manage"],
  audit: ["audit.view"],
  support: ["support.view", "support.manage"],
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS][number];

export const ALL_PERMISSIONS: Permission[] = Object.values(
  PERMISSIONS
).flat() as Permission[];

const AGENT_BASE: Permission[] = [
  "reconciliation.view",
  "reports.view",
  "reports.export",
  "submissions.view",
  "support.view",
];

const ASSISTANT_BASE: Permission[] = [
  "reconciliation.view",
  "reports.view",
  "submissions.view",
  "support.view",
];

const TECH_SUPPORT_BASE: Permission[] = [
  "agents.view",
  "imports.preview",
  "reconciliation.view",
  "reports.view",
  "users.view",
  "audit.view",
  "support.view",
  "support.manage",
];

/**
 * Default resolution of role -> permissions.
 * Admins intentionally get a configured subset, NOT everything.
 */
export function permissionsForRole(role: RoleCode): Permission[] {
  switch (role) {
    case "super_admin":
      return ALL_PERMISSIONS;
    case "admin":
      return [
        "agents.view",
        "agents.edit",
        "assistants.view",
        "imports.preview",
        "reconciliation.view",
        "reconciliation.view_all",
        "reconciliation.resolve_exceptions",
        "reports.view",
        "reports.export",
        "reports.send",
        "submissions.view",
        "submissions.review",
        "communications.send",
        "users.view",
        "audit.view",
        "support.view",
      ];
    case "agent":
      return AGENT_BASE;
    case "assistant":
      return ASSISTANT_BASE;
    case "tech_support":
      return TECH_SUPPORT_BASE;
    default:
      return [];
  }
}

export function roleLabel(role: RoleCode): string {
  const labels: Record<RoleCode, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    agent: "Agent",
    assistant: "Assistant",
    tech_support: "Tech Support",
  };
  return labels[role] ?? role;
}

/** Convenience check used for UI hints. Server/RLS enforcement is authoritative. */
export function can(
  userPermissions: readonly Permission[],
  permission: Permission
): boolean {
  return userPermissions.includes(permission);
}
