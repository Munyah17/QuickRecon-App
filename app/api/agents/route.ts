import { NextRequest, NextResponse } from "next/server";
import { fkConflictMessage } from "@/lib/api/fk-conflict";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/agents — company staff list all agents (directory). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await sb
    .from("agents")
    .select("id, full_name, email, phone, province, location, status, national_id, icecash_id, kyc_status, joined_at")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Real per-agent financials aggregated from reconciliation documents —
  // commission earned, deposits received and latest closing position. These
  // replace the fabricated float/bonus/sales figures the directory used to show.
  const { data: docs } = await sb
    .from("reconciliation_documents")
    .select("agent_id, commission, deposits, closing_position");
  const fin = new Map<string, { commission: number; deposits: number; closing: number }>();
  for (const d of docs ?? []) {
    const cur = fin.get(d.agent_id) ?? { commission: 0, deposits: 0, closing: 0 };
    cur.commission += Number(d.commission) || 0;
    cur.deposits += Number(d.deposits) || 0;
    cur.closing += Number(d.closing_position) || 0;
    fin.set(d.agent_id, cur);
  }

  const agents = (data ?? []).map((a) => ({
    ...a,
    commission: fin.get(a.id)?.commission ?? 0,
    deposits: fin.get(a.id)?.deposits ?? 0,
    closing_position: fin.get(a.id)?.closing ?? 0,
  }));
  return NextResponse.json({ agents });
}

const AGENT_STATUSES = ["active", "suspended", "inactive", "pending"] as const;
/** Statuses a bulk update may SET — "pending" is import-only, never assigned here. */
const SETTABLE_STATUSES = ["active", "suspended", "inactive"] as const;

/**
 * PATCH /api/agents — company staff bulk-update agent status.
 * Body: { status, ids?: string[], fromStatus?: string }
 * `ids` limits the update to those agents; `fromStatus` selects every agent
 * currently in that state — e.g. { fromStatus: "pending", status: "active" }
 * activates everything left pending by a bulk import. At least one selector
 * is required so a bare payload can't flip the whole table.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can update agents" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "");
  if (!(SETTABLE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter(
        (i): i is string => typeof i === "string" && i.trim().length > 0
      )
    : [];
  const fromStatus = typeof body?.fromStatus === "string" ? body.fromStatus : null;
  if (ids.length === 0 && !fromStatus) {
    return NextResponse.json({ error: "Provide ids[] or fromStatus" }, { status: 400 });
  }
  if (fromStatus && !(AGENT_STATUSES as readonly string[]).includes(fromStatus)) {
    return NextResponse.json({ error: "Invalid fromStatus" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const query = sb.from("agents").update({ status });
  const { data, error } = await (ids.length
    ? query.in("id", ids)
    : query.eq("status", fromStatus!)
  ).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}

/**
 * DELETE /api/agents — company staff bulk-delete agents.
 * Body: { ids: string[] } — required so a bare payload can't wipe the table.
 *
 * Each agent is deleted individually: agents that are part of the audit trail
 * (reconciliations, exceptions…) are FK-restricted and must not abort the
 * whole batch. The response reports both sides: { deleted, failures[] }.
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can remove agents" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter(
        (i): i is string => typeof i === "string" && i.trim().length > 0
      )
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids[] required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // payment_methods.owner_id is polymorphic text (owner_type + owner_id) with
  // no FK — orphan rows would survive the deletes, so clear them first.
  const { error: pmError } = await sb
    .from("payment_methods")
    .delete()
    .eq("owner_type", "agent")
    .in("owner_id", ids);
  if (pmError) return NextResponse.json({ error: pmError.message }, { status: 500 });

  const failures: { id: string; error: string }[] = [];
  let deleted = 0;
  for (const id of ids) {
    const { error } = await sb.from("agents").delete().eq("id", id);
    if (!error) {
      deleted += 1;
      continue;
    }
    failures.push({
      id,
      error: fkConflictMessage(error, "agent", "set it to Inactive") ?? error.message,
    });
  }
  return NextResponse.json({ ok: true, deleted, failures });
}
