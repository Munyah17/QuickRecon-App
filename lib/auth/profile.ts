import type { RoleCode } from "@/types";

const STAFF_ROLES = new Set<RoleCode>(["super_admin", "admin", "tech_support", "finance", "operations"]);
const ALIASES: Record<string, RoleCode> = {
  superadmin: "super_admin", "super admin": "super_admin", administrator: "admin",
};

/** Use the database profile as the authority, never user-editable auth metadata. */
export function portalRole(raw: string | null | undefined): RoleCode | null {
  const normalized = raw?.trim().toLowerCase() ?? "";
  const role = ALIASES[normalized] ?? normalized as RoleCode;
  return STAFF_ROLES.has(role) ? role : null;
}

export function profileAccessError(profile: { role?: string | null; status?: string | null }): string | null {
  if (!portalRole(profile.role)) {
    return "Portal access is limited to company staff. Contact an administrator to check your assigned role.";
  }
  if (profile.status !== "active") {
    return "This account is pending, suspended or inactive. Contact an administrator to activate it.";
  }
  return null;
}
