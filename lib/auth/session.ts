import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { permissionsForRole, roleLabel, type Permission } from "@/lib/auth/permissions";
import type { AppUser, RoleCode } from "@/types";

export interface SessionInfo {
  user: AppUser;
  permissions: Permission[];
  /** "supabase" when backed by a real session, "preview" otherwise. */
  source: "supabase" | "preview";
}

const PREVIEW_USERS: Record<RoleCode, AppUser> = {
  super_admin: {
    id: "usr-sa-001",
    fullName: "Munyah Griezmann",
    email: "munyamuzvidziwa19@gmail.com",
    role: "super_admin",
    roleLabel: roleLabel("super_admin"),
    status: "active",
  },
  admin: {
    id: "usr-ad-001",
    fullName: "Tererai Chiweshe",
    email: "ops@enpassent.co.zw",
    role: "admin",
    roleLabel: roleLabel("admin"),
    status: "active",
  },
  agent: {
    id: "usr-ag-184",
    fullName: "Musa Zhou",
    email: "musa@example.com",
    role: "agent",
    roleLabel: roleLabel("agent"),
    status: "active",
    agentId: "AGT-000184",
  },
  assistant: {
    id: "usr-as-011",
    fullName: "Simbarashe Dube",
    email: "simba@example.com",
    role: "assistant",
    roleLabel: roleLabel("assistant"),
    status: "active",
    agentId: "AGT-000184",
    parentAgentId: "AGT-000184",
  },
  tech_support: {
    id: "usr-ts-001",
    fullName: "Taridzo Support",
    email: "support@enpassent.co.zw",
    role: "tech_support",
    roleLabel: roleLabel("tech_support"),
    status: "active",
  },
};

function previewUser(role: RoleCode): AppUser {
  return { ...PREVIEW_USERS[role] };
}

/**
 * Resolve the current session. When Supabase is configured this reads the
 * auth cookie and loads the profile + permissions. Otherwise the app runs
 * in preview mode; the role comes from the `qr_preview_role` cookie set on
 * the login screen so every portal can be reviewed without a backend.
 */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();

  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, agent_id, parent_agent_id")
      .eq("id", authUser.id)
      .single();

    const role = (profile?.role ?? "agent") as RoleCode;
    const user: AppUser = {
      id: authUser.id,
      fullName: profile?.full_name ?? authUser.email ?? "User",
      email: profile?.email ?? authUser.email ?? "",
      role,
      roleLabel: roleLabel(role),
      status: profile?.status ?? "active",
      agentId: profile?.agent_id ?? undefined,
      parentAgentId: profile?.parent_agent_id ?? undefined,
    };
    return {
      user,
      permissions: permissionsForRole(role),
      source: "supabase",
    };
  }

  const cookieStore = await cookies();
  const role = (cookieStore.get("qr_preview_role")?.value ??
    "super_admin") as RoleCode;
  const user = previewUser(role);
  return { user, permissions: permissionsForRole(role), source: "preview" };
});

/**
 * UI-level guard helper. Database RLS + server checks are the real wall.
 */
export function requireRole(session: SessionInfo, roles: RoleCode[]): boolean {
  return roles.includes(session.user.role);
}
