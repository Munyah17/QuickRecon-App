import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { fkConflictResponse } from "@/lib/api/fk-conflict";
import { AGENT_POS_BANKS, posSchemeForBank } from "@/types";

export const runtime = "nodejs";

const EDITABLE = [
  "full_name",
  "email",
  "phone",
  "province",
  "location",
  "national_id",
  "icecash_id",
  "status",
] as const;

/** Super admins may also touch identity/verification columns. */
const SUPER_ONLY = ["kyc_status", "joined_at", "user_id"] as const;

const VALID_MODULES = new Set(["enpassent", "econet-moovah"]);
/** ZINARA code is indexed under both schemes by different writers. */
const ZINARA_SCHEMES = ["zinara_user", "zinara_id"];

/**
 * PATCH /api/agents/[id]
 * Company staff update an agent's profile fields. The agents table has no
 * UPDATE RLS policy, so this goes through the service client after an
 * explicit role check.
 * Body: { fullName?, email?, phone?, province?, location?, nationalId?, icecashId?, status?, bankPos? }
 * bankPos replaces the agent's per-bank POS IDs (agent_external_ids *_pos
 * schemes) — each bank issues its own POS device & statement.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can edit agents" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const isSuper = session.user.role === "super_admin";

  // Map camelCase payload → snake_case columns, keep only editable fields.
  const keyMap: Record<string, string> = {
    fullName: "full_name",
    nationalId: "national_id",
    icecashId: "icecash_id",
    iceCashId: "icecash_id",
    kycStatus: "kyc_status",
    joinedAt: "joined_at",
    userId: "user_id",
  };
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const col = keyMap[k] ?? k;
    const allowed =
      (EDITABLE as readonly string[]).includes(col) ||
      (isSuper && (SUPER_ONLY as readonly string[]).includes(col));
    if (allowed) {
      patch[col] = v === "" ? null : v;
    }
  }
  if (patch.status && !["active", "suspended", "inactive", "pending"].includes(String(patch.status))) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Module assignment — `modules` is the full enabled set (string[] or
  // [{module, enabled}]): listed modules are enabled, the rest disabled.
  const hasModules = Array.isArray(body.modules);
  let enabledModules = new Set<string>();
  if (hasModules) {
    for (const raw of body.modules as unknown[]) {
      const m = typeof raw === "string" ? raw : (raw as { module?: unknown })?.module;
      if (typeof m !== "string" || !VALID_MODULES.has(m)) {
        return NextResponse.json(
          { error: `Invalid module — expected one of ${[...VALID_MODULES].join(", ")}` },
          { status: 400 }
        );
      }
      const enabled = typeof raw === "string" ? true : (raw as { enabled?: unknown }).enabled !== false;
      if (enabled) enabledModules.add(m);
    }
    // One agent, one source company.
    if (enabledModules.size > 1) {
      return NextResponse.json(
        { error: "An agent works a single source company — enable one module only." },
        { status: 400 }
      );
    }
  }

  // ZINARA account ID — replaces the agent's zinara_* external-id rows.
  const hasZinara = typeof body.zinaraId === "string";
  const zinaraId = hasZinara ? (body.zinaraId as string).trim() : "";

  // Per-bank POS IDs — [{ bank, posId }] with blank posIds removed. When the
  // key is present at all (even []), the agent's *_pos rows are replaced.
  const hasBankPos = Array.isArray(body.bankPos);
  const validBanks = new Set<string>(AGENT_POS_BANKS);
  const bankPos: { bank: string; posId: string }[] = [];
  if (hasBankPos) {
    for (const entry of body.bankPos as unknown[]) {
      const e = entry as { bank?: unknown; posId?: unknown };
      if (typeof e?.bank !== "string" || !validBanks.has(e.bank)) {
        return NextResponse.json(
          { error: `Invalid bank in bankPos — expected one of ${AGENT_POS_BANKS.join(", ")}` },
          { status: 400 }
        );
      }
      const posId = typeof e.posId === "string" ? e.posId.trim() : "";
      if (posId) bankPos.push({ bank: e.bank, posId });
    }
  }

  if (Object.keys(patch).length === 0 && !hasBankPos && !hasModules && !hasZinara) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const service = await createServiceClient();
  if (!service) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  if (Object.keys(patch).length > 0) {
    const { data, error } = await service
      .from("agents")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (hasBankPos) {
    // Replace this agent's POS schemes wholesale — banks left blank are
    // removed rather than left stale.
    const { error: delError } = await service
      .from("agent_external_ids")
      .delete()
      .eq("agent_id", id)
      .in("scheme", AGENT_POS_BANKS.map((b) => posSchemeForBank(b)));
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    if (bankPos.length) {
      const { error: insError } = await service.from("agent_external_ids").insert(
        bankPos.map((p) => ({
          agent_id: id,
          scheme: posSchemeForBank(p.bank),
          value: p.posId,
        }))
      );
      if (insError) {
        return NextResponse.json(
          {
            error:
              insError.code === "23505"
                ? "One of the POS IDs is already assigned to another agent"
                : insError.message,
          },
          { status: insError.code === "23505" ? 409 : 500 }
        );
      }
    }
  }

  if (hasModules) {
    const { error: modError } = await service.from("agent_modules").upsert(
      [...VALID_MODULES].map((m) => ({
        agent_id: id,
        module: m,
        enabled: enabledModules.has(m),
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "agent_id,module" }
    );
    if (modError) return NextResponse.json({ error: modError.message }, { status: 500 });
  }

  if (hasZinara) {
    const { error: delError } = await service
      .from("agent_external_ids")
      .delete()
      .eq("agent_id", id)
      .in("scheme", ZINARA_SCHEMES);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    if (zinaraId) {
      // Index the bare code too when the value carries a " - NAME" suffix.
      const variants = [zinaraId];
      const dash = zinaraId.indexOf(" - ");
      if (dash > 0) variants.push(zinaraId.slice(0, dash).trim());
      const idRows = [...new Set(variants.filter(Boolean))].map((v) => ({
        agent_id: id,
        scheme: "zinara_user",
        value: v,
      }));
      let { error: zError } = await service.from("agent_external_ids").insert(idRows);
      if (zError?.code === "23505") {
        if (!isSuper) {
          return NextResponse.json(
            { error: `ZINARA code ${zinaraId} is already assigned to another agent — only a super admin can reassign it.` },
            { status: 409 }
          );
        }
        // Super-admin override: re-point the claimed code to this agent.
        const { error: reError } = await service
          .from("agent_external_ids")
          .upsert(idRows, { onConflict: "scheme,value" });
        zError = reError;
      }
      if (zError) return NextResponse.json({ error: zError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

/** PUT /api/agents/[id]/modules style — handled here as PATCH with
 * { modules: [{ module, enabled }] } so the profile-page toggles persist.
 * Kept in the same handler to avoid another round trip. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can manage agent modules" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mods = Array.isArray(body?.modules) ? body.modules : null;
  if (!mods || mods.length === 0) {
    return NextResponse.json({ error: "modules[] required" }, { status: 400 });
  }
  const VALID = new Set(["enpassent", "econet-moovah"]);
  const rows = (mods as { module?: unknown; enabled?: unknown }[])
    .filter((m): m is { module: string; enabled: boolean } =>
      typeof m?.module === "string" && VALID.has(m.module) && typeof m?.enabled === "boolean")
    .map((m) => ({
      agent_id: id,
      module: m.module,
      enabled: m.enabled,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid modules provided" }, { status: 400 });
  }

  const service = await createServiceClient();
  if (!service) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // One agent, one source company — PUT toggles individual modules, so the
  // check must merge the payload with the agent's current enabled set.
  const { data: existing } = await service
    .from("agent_modules")
    .select("module, enabled")
    .eq("agent_id", id);
  const enabledNow = new Set(
    (existing ?? []).filter((r) => r.enabled).map((r) => r.module as string)
  );
  for (const r of rows) {
    if (r.enabled) enabledNow.add(r.module);
    else enabledNow.delete(r.module);
  }
  if (enabledNow.size > 1) {
    return NextResponse.json(
      { error: "An agent works a single source company — disable the other module first." },
      { status: 400 }
    );
  }

  const { error } = await service
    .from("agent_modules")
    .upsert(rows, { onConflict: "agent_id,module" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/agents/[id]
 * Company staff permanently remove an agent and every linked record —
 * not a suspend. FK-restricted dependents are purged in dependency order
 * (children before parents); audit-preserving references that allow NULL
 * are detached instead of deleted so exception/audit history survives.
 * Cascade-declared dependents (booths, assistants, external ids, modules,
 * submissions, recon lines/versions/adjustments) go with the agent.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can remove agents" }, { status: 403 });
  }

  const { id } = await params;
  const service = await createServiceClient();
  if (!service) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Steps run in order; failures are collected — the agent delete below is
  // the real gate and reports whichever table is still blocking.
  const steps: { label: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
    // Polymorphic owner link — no FK, orphans would survive.
    { label: "payment_methods", run: () => service.from("payment_methods").delete().eq("owner_type", "agent").eq("owner_id", id) },
    // FK-restricted dependents — must go before agents.delete.
    { label: "reconciliation_deliveries", run: () => service.from("reconciliation_deliveries").delete().eq("agent_id", id) },
    { label: "reconciliation_documents", run: () => service.from("reconciliation_documents").delete().eq("agent_id", id) },
    // reports.reconciliation_id also restricts the reconciliations delete.
    { label: "reports", run: () => service.from("reports").delete().eq("agent_id", id) },
    // Cascades reconciliation_lines, _versions, _adjustments, agent_discrepancies.
    { label: "reconciliations", run: () => service.from("reconciliations").delete().eq("agent_id", id) },
    { label: "distribution_recipients", run: () => service.from("distribution_recipients").delete().eq("agent_id", id) },
    // Nullable references — detach rather than delete so batch/exception/
    // ticket history keeps its audit trail.
    { label: "reconciliation_exceptions", run: () => service.from("reconciliation_exceptions").update({ agent_id: null }).eq("agent_id", id) },
    { label: "support_tickets", run: () => service.from("support_tickets").update({ agent_id: null }).eq("agent_id", id) },
    { label: "normalised_records", run: () => service.from("normalised_records").update({ agent_id: null }).eq("agent_id", id) },
    // The agent's login profile survives — just unlinked.
    { label: "profiles", run: () => service.from("profiles").update({ agent_id: null }).eq("agent_id", id) },
  ];

  const failed: string[] = [];
  for (const step of steps) {
    const { error } = await step.run();
    if (error) {
      // A missing table/column in a partially-migrated env shouldn't block
      // the delete — FK on agents is what actually enforces linkage.
      console.error(`agent delete: ${step.label} cleanup failed: ${error.message}`);
      failed.push(step.label);
    }
  }

  const { error } = await service.from("agents").delete().eq("id", id);
  if (error) {
    const conflict = fkConflictResponse(error, "agent");
    if (conflict) return conflict;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await service.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "agent.deleted",
    entity: "agent",
    entity_id: id,
    metadata: { cleanupFailures: failed },
  });

  return NextResponse.json({ ok: true });
}
