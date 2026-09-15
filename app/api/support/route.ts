import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { isCompanyRole } from "@/lib/nav";

export const runtime = "nodejs";

const CATEGORIES = new Set([
  "technical", "account_access", "reconciliation_query",
  "submission_issue", "report_issue", "other",
]);

/** POST /api/support — create a support ticket. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, subject, description, module } = await request.json();
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!subject?.trim() || !description?.trim() || description.trim().length < 10) {
    return NextResponse.json({ error: "Subject and a description (min 10 chars) are required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ id: `TKT-${Date.now() % 1000}`, preview: true });

  const { data, error } = await sb
    .from("support_tickets")
    .insert({
      user_id: session.user.id,
      agent_id: session.user.agentId ?? null,
      created_by: session.user.id,
      module: module === "enpassent" || module === "econet-moovah" ? module : null,
      category,
      subject: subject.trim(),
      description: description.trim(),
      status: "open",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, status: "open" });
}

/** PATCH /api/support — company users update a ticket status. */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status } = await request.json();
  if (!id || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    return NextResponse.json({ error: "id and a valid status required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ ok: true, preview: true });

  const { error } = await sb
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
