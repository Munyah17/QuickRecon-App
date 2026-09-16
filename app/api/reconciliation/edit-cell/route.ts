import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Editable reconciliation fields — whitelist, numeric only. */
const EDITABLE = new Set([
  "opening_position",
  "insurance",
  "zinara",
  "deposits",
  "adjustments",
  "closing_position",
]);

/**
 * Super-admin inline cell editing for reconciliations.
 * Every edit is written to audit_logs with previous/next values.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { reconId, field, value } = body as {
    reconId?: string;
    field?: string;
    value?: number;
  };

  if (!reconId || !field || !EDITABLE.has(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NextResponse.json({ error: "Numeric value required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  // Read the current value for the audit trail.
  const { data: before } = await sb
    .from("reconciliations")
    .select(field)
    .eq("id", reconId)
    .single();

  const previous = before ? Number((before as unknown as Record<string, unknown>)[field]) : null;

  const { error } = await sb
    .from("reconciliations")
    .update({ [field]: value })
    .eq("id", reconId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit trail — who changed what, from what to what.
  await sb.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "reconciliation_cell_edit",
    entity: "reconciliations",
    entity_id: reconId,
    previous: { [field]: previous },
    next: { [field]: value },
    metadata: { field, ip: request.headers.get("x-forwarded-for") ?? undefined },
  });

  return NextResponse.json({ success: true, previous, value });
}
