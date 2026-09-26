import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STATUSES = new Set(["active", "suspended", "pending", "inactive", "rejected"]);

/**
 * PATCH /api/assistants/[id] — update an assistant's status/permissions.
 * Company staff approve, suspend or edit an assistant account.
 * Body: { status?, permissions?, boothId? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can update assistants" }, { status: 403 });
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
    if (b.status === "active") patch.approved_by = session.user.id;
  }
  if (Array.isArray(b.permissions)) patch.requested_permissions = b.permissions;
  if (b.boothId !== undefined) patch.booth_id = b.boothId || null;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  }

  const { data, error } = await sb.from("assistants").update(patch).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
  return NextResponse.json({ assistant: data });
}

/** DELETE /api/assistants/[id] — remove an assistant account. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can remove assistants" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await params;
  const { error } = await sb.from("assistants").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
