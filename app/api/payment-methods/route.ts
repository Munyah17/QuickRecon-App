import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KINDS = new Set(["bank", "mobile_money", "other"]);
const OWNERS = new Set(["staff", "agent"]);

/**
 * GET /api/payment-methods?ownerType=staff|agent&ownerId=EMP-001
 * Company staff list remuneration payment methods for a profile.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const ownerType = request.nextUrl.searchParams.get("ownerType");
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  let q = sb.from("payment_methods").select("*").order("is_primary", { ascending: false }).order("id");
  if (ownerType && OWNERS.has(ownerType)) q = q.eq("owner_type", ownerType);
  if (ownerId) q = q.eq("owner_id", ownerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ methods: data ?? [] });
}

/** POST /api/payment-methods — add a payment method to a staff/agent profile. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const ownerType = String(b.ownerType ?? "");
  const ownerId = String(b.ownerId ?? "").trim();
  const kind = String(b.kind ?? "");
  if (!OWNERS.has(ownerType) || !ownerId) {
    return NextResponse.json({ error: "ownerType and ownerId are required" }, { status: 400 });
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid payment method kind" }, { status: 400 });
  }

  // Verify the owner actually exists so methods can't attach to phantom ids.
  const table = ownerType === "staff" ? "staff" : "agents";
  const { data: owner } = await sb.from(table).select("id").eq("id", ownerId).maybeSingle();
  if (!owner) {
    return NextResponse.json({ error: `${ownerType === "staff" ? "Staff" : "Agent"} not found` }, { status: 404 });
  }

  const row = {
    owner_type: ownerType,
    owner_id: ownerId,
    kind,
    label: (b.label as string) || null,
    bank_name: (b.bankName as string) || null,
    branch_code: (b.branchCode as string) || null,
    account_name: (b.accountName as string) || null,
    account_number: (b.accountNumber as string) || null,
    provider: (b.provider as string) || null,
    mobile_number: (b.mobileNumber as string) || null,
    currency: (b.currency as string) || "USD",
    is_primary: Boolean(b.isPrimary),
    details: (b.details as Record<string, unknown>) ?? {},
    created_by: session.user.id,
  };

  // If this is marked primary, clear the flag on the owner's other methods.
  if (row.is_primary) {
    await sb.from("payment_methods").update({ is_primary: false })
      .eq("owner_type", ownerType).eq("owner_id", ownerId);
  }

  const { data, error } = await sb.from("payment_methods").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ method: data }, { status: 201 });
}
