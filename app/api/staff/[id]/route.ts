import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EDITABLE: Record<string, string> = {
  fullName: "full_name",
  jobTitle: "job_title",
  department: "department",
  salary: "salary",
  status: "status",
  phone: "phone",
  email: "email",
};
const STATUSES = new Set(["active", "suspended", "pending", "inactive", "on_leave"]);

/** PATCH /api/staff/[id] — update an employee record. */
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
  for (const [k, col] of Object.entries(EDITABLE)) {
    if (k in b) patch[col] = b[k] === "" ? null : b[k];
  }
  if (patch.status && !STATUSES.has(String(patch.status))) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (patch.salary != null) patch.salary = Number(patch.salary) || 0;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await sb.from("staff").update(patch).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ staff: data });
}

/** DELETE /api/staff/[id] — remove an employee record. */
export async function DELETE(
  _request: NextRequest,
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
  const { error } = await sb.from("staff").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
