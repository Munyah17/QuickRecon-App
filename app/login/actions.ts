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
  "musa@example.com": { password: "agent123", role: "agent" },
  "simba@example.com": { password: "assistant123", role: "assistant" },
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
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
