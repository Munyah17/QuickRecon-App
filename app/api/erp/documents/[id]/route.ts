import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STATUSES = new Set(["draft", "pending", "sent", "paid", "overdue", "accepted", "declined"]);

/** PATCH /api/erp/documents/[id] — update status / amount_paid / notes. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.status != null) {
    if (!STATUSES.has(String(b.status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = b.status;
    // Marking paid records the full amount as received.
    if (b.status === "paid") {
      const { data: cur } = await sb.from("erp_documents").select("amount").eq("id", id).maybeSingle();
      if (cur) patch.amount_paid = cur.amount;
    }
  }
  if (b.amountPaid != null) patch.amount_paid = Number(b.amountPaid) || 0;
  if (b.notes !== undefined) patch.notes = b.notes || null;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  }

  const { data, error } = await sb.from("erp_documents").update(patch).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json({ document: data });
}
