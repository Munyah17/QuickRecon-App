"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileAccessError } from "@/lib/auth/profile";
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
  email = email.trim().toLowerCase();
  const supabase = await createClient();
  if (!supabase) {
    const cred = PREVIEW_CREDENTIALS[email.toLowerCase()];
    if (!cred || cred.password !== password) {
      return { error: "Invalid email or password" };
    }
    const cookieStore = await cookies();
    cookieStore.set("qr_preview_role", cred.role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/app/dashboard");
  }
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Verify a usable profile exists before letting them in — otherwise the
  // session resolves to null on the next request and they bounce back to
  // /login with no explanation.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[loginWithPassword] profile lookup failed:", profileError.message);
    await supabase.auth.signOut();
    return { error: "Could not load your account profile. Please try again or contact support." };
  }
  if (!profile) {
    console.error("[loginWithPassword] no profile row for user:", auth.user.id);
    await supabase.auth.signOut();
    return { error: "Your account has no portal profile. Ask an admin to create one before signing in." };
  }

  const accessError = profileAccessError(profile);
  if (accessError) {
    await supabase.auth.signOut();
    return { error: accessError };
  }

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

/** End the current browser session on the server, including HTTP-only cookies. */
export async function logout(): Promise<LoginResult> {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Unable to sign out. Please try again." };
  }
  const cookieStore = await cookies();
  cookieStore.delete("qr_preview_role");
  redirect("/login");
}
