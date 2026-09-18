import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Statuses a company user may move an exception to. */
const ALLOWED = new Set(["resolved", "investigating", "ignored"]);

/**
 * Resolve / investigate / ignore a reconciliation exception.
 * Writes status (+ resolution reason, resolver, timestamps) and audit-logs it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Company staff only" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    resolution?: string;
  };
  const status = body.status;
  const reason = (body.resolution ?? "").trim();

  if (!status || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (status === "ignored" && !reason) {
    return NextResponse.json(
      { error: "A written reason is required to ignore an exception." },
      { status: 400 }
    );
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const update: Record<string, unknown> = { status };
  if (status === "resolved" || status === "ignored") {
    update.resolved_by = session.user.id;
    update.resolved_at = new Date().toISOString();
    if (reason) update.resolution = reason;
  } else {
    // investigating — claim it and clear any stale resolution markers.
    update.assignee = session.user.id;
    update.resolved_by = null;
    update.resolved_at = null;
  }

  const { error } = await sb
    .from("reconciliation_exceptions")
    .update(update)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("audit_logs").insert({
    actor_id: session.user.id,
    action: `exception_${status}`,
    entity: "reconciliation_exceptions",
    entity_id: String(id),
    next: { status, resolution: reason || undefined },
  });

  return NextResponse.json({ success: true, status });
}
