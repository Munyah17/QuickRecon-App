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

/** Map a raw profiles.role value to a valid RoleCode (defaults to "agent"). */
function normalizeRole(raw: string | null | undefined): RoleCode {
  if (!raw) return "agent";
  const normalized = raw.trim().toLowerCase();
  return ROLE_ALIASES[normalized] ?? "agent";
}

/**
 * Resolve the current session. When Supabase is configured this reads the
 * auth cookie and loads the profile + permissions. Otherwise the app runs
 * in preview mode; the role comes from the `qr_preview_role` cookie set on
 * the login screen so every portal can be reviewed without a backend.
 */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  try {
    const supabase = await createClient();

    if (!supabase) {
      console.warn("[getSession] Supabase client not available, using preview mode");
      const cookieStore = await cookies();
      const rawRole = cookieStore.get("qr_preview_role")?.value ?? "super_admin";
      const role = (rawRole in PREVIEW_USERS ? rawRole : "super_admin") as RoleCode;
      const user = previewUser(role);
      return { user, permissions: permissionsForRole(role), source: "preview" };
    }

    // Get auth user with error handling
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("[getSession] Auth error:", authError.message);
      return null;
    }
    if (!authData.user) {
      console.log("[getSession] No auth user found");
      return null;
    }

    // Get profile with error handling
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, agent_id")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("[getSession] Profile query error:", profileError.message, profileError.code);
      // If profile doesn't exist, we can't determine role - return null
      if (profileError.code === "PGRST116") {
        console.error("[getSession] Profile not found for user:", authData.user.id);
        return null;
      }
      return null;
    }

    if (!profile) {
      console.error("[getSession] Profile is null for user:", authData.user.id);
      return null;
    }

    // Check if user status allows access
    if (profile.status === "suspended" || profile.status === "inactive") {
      console.log("[getSession] User account suspended/inactive:", profile.status);
      return null;
    }

    // Field roles have no portal access — treat their sessions as unauthenticated
    const rawRole = (profile.role ?? "").trim().toLowerCase();
    console.log("[getSession] Raw role from database:", rawRole, "full value:", profile.role);
    if (rawRole === "agent" || rawRole === "assistant") {
      console.log("[getSession] Field role rejected:", rawRole);
      return null;
    }

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

    console.log("[getSession] Session resolved for user:", user.email, "role:", role);
    return {
      user,
      permissions: permissionsForRole(role),
      source: "supabase",
    };
  } catch (error) {
    console.error("[getSession] Unexpected error:", error);
    return null;
  }
});

/**
 * UI-level guard helper. Database RLS + server checks are the real wall.
 */
export function requireRole(session: SessionInfo, roles: RoleCode[]): boolean {
  return roles.includes(session.user.role);
}
