"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/types";

export interface LoginResult {
  error?: string;
}

const PREVIEW_CREDENTIALS: Record<string, { password: string; role: RoleCode }> = {
  "munyamuzvidziwa19@gmail.com": { password: "@@Griezmann177#$", role: "super_admin" },
  "support@enpassent.co.zw": { password: "support123", role: "tech_support" },
  "ops@enpassent.co.zw": { password: "admin123", role: "admin" },
};

/**
 * Standard password sign-in via Supabase Auth.
 * In preview mode (no Supabase), validates against PREVIEW_CREDENTIALS.
 */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<LoginResult> {
  console.log("[loginWithPassword] Attempting login for:", email);
  const supabase = await createClient();
  if (!supabase) {
    console.log("[loginWithPassword] Preview mode - no Supabase client");
    const cred = PREVIEW_CREDENTIALS[email.toLowerCase()];
    if (!cred || cred.password !== password) {
      console.log("[loginWithPassword] Invalid preview credentials");
      return { error: "Invalid email or password" };
    }
    console.log("[loginWithPassword] Preview login successful, role:", cred.role);
    const cookieStore = await cookies();
    cookieStore.set("qr_preview_role", cred.role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    console.log("[loginWithPassword] Redirecting to /app/dashboard");
    redirect("/app/dashboard");
  }
  console.log("[loginWithPassword] Supabase client available, signing in");
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[loginWithPassword] Sign in error:", error.message);
    return { error: error.message };
  }
  console.log("[loginWithPassword] Sign in successful, user ID:", auth.user.id);

  // PERMISSIONS BYPASSED FOR DEBUGGING - allowing all roles
  console.log("[loginWithPassword] Redirecting to /app/dashboard");
  redirect("/app/dashboard");
}

/**
 * Preview-mode entry: no real session, just selects which portal to review.
 * Disabled automatically once NEXT_PUBLIC_SUPABASE_URL is configured.
 */
export async function loginAsPreviewRole(role: RoleCode): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    return; // preview sign-in unavailable against a real backend
  }
  const cookieStore = await cookies();
  cookieStore.set("qr_preview_role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/app/dashboard");
}
