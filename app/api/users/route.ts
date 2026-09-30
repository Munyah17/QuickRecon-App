import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/types";

export const runtime = "nodejs";

const VALID_ROLES: RoleCode[] = ["super_admin", "admin", "agent", "assistant", "tech_support"];

/**
 * POST /api/users — create a staff account.
 * Creates the Supabase auth user (service role), the profiles row, and —
 * for agents/assistants — a matching agents row so identity resolution
 * and reconciliation scoping work immediately.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("users.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, email, phone, nationalId, location, province, role, moduleAccess, password } = body ?? {};

  if (!fullName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Password is optional for agent/assistant accounts — generate a one-time
  // temporary password that is returned to the admin to share.
  const generatedPassword = typeof password !== "string" || password.length === 0;
  const finalPassword = generatedPassword
    ? `Qr-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`
    : password;
  if (typeof finalPassword !== "string" || finalPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    // Preview mode (no Supabase) — acknowledge without persisting.
    return NextResponse.json({ status: "pending", preview: true });
  }

  const { data: authUser, error: authError } = await sb.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: finalPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim(), role },
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authUser.user.id;

  // profiles has no national_id/location columns — those live on agents.
  // Upsert: a handle_new_user DB trigger may have already inserted a stub
  // row (with default role) when the auth user was created — overwrite it.
  const { error: profileError } = await sb.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: "active",
      phone: phone || null,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (role === "agent" || role === "assistant") {
    // Sequential agent id: AGT-000xxx based on count.
    const { count } = await sb
      .from("agents")
      .select("id", { count: "exact", head: true });
    const agentId = `AGT-${String((count ?? 0) + 1).padStart(6, "0")}`;
    const { error: agentError } = await sb.from("agents").insert({
      id: agentId,
      user_id: userId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      province: province || location || null,
      location: location || null,
      national_id: nationalId || null,
      status: "pending",
      kyc_status: "pending",
    });
    if (agentError) {
      // Roll back so a failed agent insert doesn't leave an orphaned login.
      await sb.from("profiles").delete().eq("id", userId);
      await sb.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Agent profile could not be created: ${agentError.message}` },
        { status: 500 }
      );
    }
    await sb.from("profiles").update({ agent_id: agentId }).eq("id", userId);
    const modules = moduleAccess === "both"
      ? ["enpassent", "econet-moovah"]
      : [moduleAccess].filter(Boolean);
    if (modules.length) {
      await sb.from("agent_modules").insert(
        modules.map((m: string) => ({ agent_id: agentId, module: m }))
      );
    }
    return NextResponse.json({
      status: "pending",
      userId,
      agentId,
      ...(generatedPassword ? { tempPassword: finalPassword } : {}),
    });
  }

  return NextResponse.json({
    status: "active",
    userId,
    ...(generatedPassword ? { tempPassword: finalPassword } : {}),
  });
}

/**
 * PATCH /api/users — admin updates a staff account.
 * Supports: password reset (admin-set), role change, status change.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("users.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, email, fullName, nationalId, phone, location, password, role, status } = body ?? {};
  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ ok: true, preview: true });

  // Resolve the auth user id (profiles.id == auth.users.id).
  let uid: string | undefined = userId;
  if (!uid) {
    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("email", String(email).trim().toLowerCase())
      .maybeSingle();
    uid = profile?.id;
    if (!uid) return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const authUpdate: Record<string, unknown> = {};
  if (password) authUpdate.password = password;
  // `email` is the new address when userId was the lookup key.
  if (userId && email) authUpdate.email = String(email).trim().toLowerCase();
  if (Object.keys(authUpdate).length) {
    const { error } = await sb.auth.admin.updateUserById(uid, authUpdate);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (fullName) profileUpdate.full_name = String(fullName).trim();
  if (userId && email) profileUpdate.email = String(email).trim().toLowerCase();
  if (role) profileUpdate.role = role;
  if (status) profileUpdate.status = status;
  if (phone !== undefined) profileUpdate.phone = phone || null;
  if (Object.keys(profileUpdate).length) {
    const { error } = await sb.from("profiles").update(profileUpdate).eq("id", uid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // national_id/location live on agents, not profiles — update them there
  // when this account is a field (agent) user.
  const agentUpdate: Record<string, unknown> = {};
  if (nationalId !== undefined) agentUpdate.national_id = nationalId || null;
  if (location !== undefined) agentUpdate.location = location || null;
  if (Object.keys(agentUpdate).length) {
    const { data: profile } = await sb
      .from("profiles")
      .select("agent_id")
      .eq("id", uid)
      .maybeSingle();
    if (profile?.agent_id) {
      const { error } = await sb
        .from("agents")
        .update(agentUpdate)
        .eq("id", profile.agent_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
