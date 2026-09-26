import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KINDS = new Set(["bank", "mobile_money", "other"]);

const FIELD_MAP: Record<string, string> = {
  kind: "kind",
  label: "label",
  bankName: "bank_name",
  branchCode: "branch_code",
  accountName: "account_name",
  accountNumber: "account_number",
  provider: "provider",
  mobileNumber: "mobile_number",
  currency: "currency",
  isPrimary: "is_primary",
  details: "details",
};

/** PATCH /api/payment-methods/[id] — update a payment method. */
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
  for (const [k, col] of Object.entries(FIELD_MAP)) {
    if (k in b) patch[col] = b[k] === "" ? null : b[k];
  }
  if (patch.kind && !KINDS.has(String(patch.kind))) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  // Setting primary clears the flag on the owner's other methods.
  if (patch.is_primary === true) {
    const { data: cur } = await sb.from("payment_methods").select("owner_type,owner_id").eq("id", id).maybeSingle();
    if (cur) {
      await sb.from("payment_methods").update({ is_primary: false })
        .eq("owner_type", cur.owner_type).eq("owner_id", cur.owner_id).neq("id", id);
    }
  }

  const { data, error } = await sb.from("payment_methods").update(patch).eq("id", id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ method: data });
}

/** DELETE /api/payment-methods/[id] — remove a payment method. */
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
  const { error } = await sb.from("payment_methods").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
