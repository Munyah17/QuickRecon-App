import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { permissionsForRole, roleLabel } from "@/lib/auth/permissions";
import type { RoleCode, AppUser } from "@/types";

export interface SessionInfo {
  user: AppUser;
  permissions: readonly string[];
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
  tech_support: {
    id: "usr-ts-001",
    fullName: "Taridzo Support",
    email: "support@enpassent.co.zw",
    role: "tech_support",
    roleLabel: roleLabel("tech_support"),
    status: "active",
  },
  finance: {
    id: "usr-fi-001",
    fullName: "Finance User",
    email: "finance@enpassent.co.zw",
    role: "finance",
    roleLabel: roleLabel("finance"),
    status: "active",
  },
  operations: {
    id: "usr-op-001",
    fullName: "Operations User",
    email: "operations@enpassent.co.zw",
    role: "operations",
    roleLabel: roleLabel("operations"),
    status: "active",
  },
};

function previewUser(role: RoleCode): AppUser {
  return { ...PREVIEW_USERS[role] };
}

const ROLE_ALIASES: Record<string, RoleCode> = {
  superadmin: "super_admin",
  super_admin: "super_admin",
  admin: "admin",
  agent: "agent",
  tech_support: "tech_support",
  finance: "finance",
  operations: "operations",
};

function normalizeRole(raw: string | null | undefined): RoleCode {
  if (!raw) return "agent";
  const normalized = raw.trim().toLowerCase();
  return ROLE_ALIASES[normalized] ?? "agent";
}

export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();

  if (!supabase) {
    const cookieStore = await cookies();
    const rawRole = cookieStore.get("qr_preview_role")?.value ?? "super_admin";
    const role = (rawRole in PREVIEW_USERS ? rawRole : "super_admin") as RoleCode;
    const user = previewUser(role);
    return { user, permissions: permissionsForRole(role), source: "preview" };
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, agent_id")
    .eq("id", authData.user.id)
    .single();

  if (!profile) return null;

  const role = normalizeRole(profile.role);
  const user: AppUser = {
    id: authData.user.id,
    fullName: profile.full_name ?? authData.user.email ?? "User",
    email: profile.email ?? authData.user.email ?? "",
    role,
    roleLabel: roleLabel(role),
    status: profile.status ?? "active",
    agentId: profile.agent_id ?? undefined,
  };

  return {
    user,
    permissions: permissionsForRole(role),
    source: "supabase",
  };
});

export function requireRole(session: SessionInfo, roles: RoleCode[]): boolean {
  return roles.includes(session.user.role);
}
