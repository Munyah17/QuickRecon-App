import { portalRole, profileAccessError } from "@/lib/auth/profile";
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

// Sample identities for preview mode only — never real people or mailboxes.
const PREVIEW_USERS: Record<RoleCode, AppUser> = {
  super_admin: {
    id: "usr-preview-sa",
    fullName: "Sample Super Admin",
    email: "super_admin@preview.local",
    role: "super_admin",
    roleLabel: roleLabel("super_admin"),
    status: "active",
  },
  admin: {
    id: "usr-preview-ad",
    fullName: "Sample Admin",
    email: "admin@preview.local",
    role: "admin",
    roleLabel: roleLabel("admin"),
    status: "active",
  },
  agent: {
    id: "usr-preview-ag",
    fullName: "Sample Agent",
    email: "agent@preview.local",
    role: "agent",
    roleLabel: roleLabel("agent"),
    status: "active",
    agentId: "AGT-000000",
  },
  tech_support: {
    id: "usr-preview-ts",
    fullName: "Sample Tech Support",
    email: "tech_support@preview.local",
    role: "tech_support",
    roleLabel: roleLabel("tech_support"),
    status: "active",
  },
  finance: {
    id: "usr-preview-fi",
    fullName: "Sample Finance",
    email: "finance@preview.local",
    role: "finance",
    roleLabel: roleLabel("finance"),
    status: "active",
  },
  operations: {
    id: "usr-preview-op",
    fullName: "Sample Operations",
    email: "operations@preview.local",
    role: "operations",
    roleLabel: roleLabel("operations"),
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
  try {
    const supabase = await createClient();

    if (!supabase) {
      console.warn("[getSession] Supabase client not available, using preview mode");
      const cookieStore = await cookies();
      // No preview-role cookie → not signed in. Redirects to /login rather
      // than silently granting a session.
      const rawRole = cookieStore.get("qr_preview_role")?.value;
      if (!rawRole) return null;
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

    if (profileAccessError(profile)) return null;
    const role = portalRole(profile.role);
    if (!role) return null;
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
