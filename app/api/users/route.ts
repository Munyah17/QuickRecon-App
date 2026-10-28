import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { fkConflictResponse } from "@/lib/api/fk-conflict";
import { AGENT_POS_BANKS, posSchemeForBank, type RoleCode } from "@/types";

export const runtime = "nodejs";

const VALID_ROLES: RoleCode[] = ["super_admin", "admin", "agent", "tech_support", "finance", "operations"];
/** Roles that hold a portal login. Field roles never appear on profiles. */
const STAFF_ROLES: RoleCode[] = ["super_admin", "admin", "tech_support", "finance", "operations"];

/**
 * POST /api/users — create a staff account or onboard a field agent.
 * Company roles get a Supabase auth login + profiles row. Agents get NO
 * login — only an agents row (+ module grants) so identity resolution
 * works; their reconciliations arrive via email/WhatsApp.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("users.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, email, phone, nationalId, location, province, role, moduleAccess, zinaraAccount, bankPos, password } = body ?? {};

  if (!fullName?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  // Staff roles need an email — it becomes their portal login. Field agents
  // have no login, so email is optional (WhatsApp/phone delivery still works).
  if (role !== "agent" && !email?.trim()) {
    return NextResponse.json({ error: "Email is required for staff accounts" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Account creation is unavailable: the server's Supabase service role is not configured. Contact an administrator." },
        { status: 503 }
      );
    }
    // Preview mode (no Supabase) — acknowledge without persisting.
    return NextResponse.json({ status: "pending", preview: true });
  }

  // Agents get NO login — the portal is company-staff only. Field agents
  // receive their consolidated reconciliations by email/WhatsApp, so we
  // create the agents row directly (user_id stays null).
  if (role === "agent") {
    const { count } = await sb
      .from("agents")
      .select("id", { count: "exact", head: true });
    const agentId = `AGT-${String((count ?? 0) + 1).padStart(6, "0")}`;
    const { error: agentError } = await sb.from("agents").insert({
      id: agentId,
      user_id: null,
      full_name: fullName.trim(),
      email: email?.trim() ? email.trim().toLowerCase() : null,
      phone: phone || null,
      province: province || location || null,
      location: location || null,
      national_id: nationalId || null,
      status: "pending",
      kyc_status: "pending",
    });
    if (agentError) {
      return NextResponse.json(
        { error: `Agent profile could not be created: ${agentError.message}` },
        { status: 500 }
      );
    }
    const modules = moduleAccess === "both"
      ? ["enpassent", "econet-moovah"]
      : [moduleAccess].filter(Boolean);
    if (modules.length) {
      await sb.from("agent_modules").insert(
        modules.map((m: string) => ({ agent_id: agentId, module: m }))
      );
    }
    // ZINARA account is an external identity — the engine resolves ZINARA
    // transaction rows to this agent via agent_external_ids. Same scheme the
    // bulk importer writes ("zinara_user").
    const zinaraId = typeof zinaraAccount === "string" ? zinaraAccount.trim() : "";
    if (zinaraId) {
      // Index the bare code too when the value carries a " - NAME" suffix —
      // source files often carry only "ZW019BJJ". Same variant logic as the
      // bulk importer.
      const variants = [zinaraId];
      const dash = zinaraId.indexOf(" - ");
      if (dash > 0) variants.push(zinaraId.slice(0, dash).trim());
      const idRows = [...new Set(variants.filter(Boolean))].map((v) => ({
        agent_id: agentId,
        scheme: "zinara_user",
        value: v,
      }));
      let { error: extError } = await sb.from("agent_external_ids").insert(idRows);
      if (extError?.code === "23505") {
        if (session.user.role !== "super_admin") {
          return NextResponse.json(
            { error: `Agent created, but ZINARA code ${zinaraId} is already assigned to another agent — only a super admin can reassign it.` },
            { status: 500 }
          );
        }
        // Super-admin override: ZINARA re-issues codes slowly, so ops sometimes
        // hands a new agent a code still claimed by another agent. Upsert
        // re-points the existing row (and inserts any missing variants) here.
        const { error: reError } = await sb
          .from("agent_external_ids")
          .upsert(idRows, { onConflict: "scheme,value" });
        extError = reError;
      }
      if (extError) {
        return NextResponse.json(
          { error: `Agent created but ZINARA account could not be saved: ${extError.message}` },
          { status: 500 }
        );
      }
    }
    // Per-bank POS IDs — each bank issues its own POS device & statement.
    // Stored as <bank>_pos schemes so rows on each bank's statement resolve
    // to this agent during reconciliation.
    if (Array.isArray(bankPos)) {
      const validBanks = new Set<string>(AGENT_POS_BANKS);
      const posRows = (bankPos as { bank?: unknown; posId?: unknown }[])
        .map((p) => ({
          bank: p?.bank,
          posId: typeof p?.posId === "string" ? p.posId.trim() : "",
        }))
        .filter(
          (p): p is { bank: string; posId: string } =>
            typeof p.bank === "string" && validBanks.has(p.bank) && Boolean(p.posId)
        );
      if (posRows.length) {
        const { error: posError } = await sb.from("agent_external_ids").insert(
          posRows.map((p) => ({
            agent_id: agentId,
            scheme: posSchemeForBank(p.bank),
            value: p.posId,
          }))
        );
        if (posError) {
          return NextResponse.json(
            {
              error:
                posError.code === "23505"
                  ? "Agent created, but a POS ID is already assigned to another agent"
                  : `Agent created but POS IDs could not be saved: ${posError.message}`,
            },
            { status: 500 }
          );
        }
      }
    }
    return NextResponse.json({ status: "pending", agentId });
  }

  // Company staff roles get a real login.
  const generatedPassword = typeof password !== "string" || password.length === 0;
  const finalPassword = generatedPassword
    ? `Qr-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`
    : password;
  if (typeof finalPassword !== "string" || finalPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
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
  if (role && !STAFF_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Staff accounts can only hold staff roles (super_admin, admin, tech_support, finance, operations). Field roles have no portal login." },
      { status: 400 }
    );
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

/**
 * DELETE /api/users — admin deletes a staff account.
 * Deletes both the auth user and the profiles row. This is irreversible.
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("users.delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId } = body ?? {};
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ ok: true, preview: true });

  // Delete the auth user first (this cascades to profiles via ON DELETE CASCADE)
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) {
    const conflict = fkConflictResponse(error, "user", "suspend their account");
    if (conflict) return conflict;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
