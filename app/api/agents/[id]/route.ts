import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

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

/**
 * PATCH /api/agents/[id]
 * Company staff update an agent's profile fields. The agents table has no
 * UPDATE RLS policy, so this goes through the service client after an
 * explicit role check.
 * Body: { fullName?, email?, phone?, province?, location?, nationalId?, icecashId?, status? }
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

  // Map camelCase payload → snake_case columns, keep only editable fields.
  const keyMap: Record<string, string> = {
    fullName: "full_name",
    nationalId: "national_id",
    icecashId: "icecash_id",
    iceCashId: "icecash_id",
  };
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const col = keyMap[k] ?? k;
    if ((EDITABLE as readonly string[]).includes(col)) {
      patch[col] = v === "" ? null : v;
    }
  }
  if (patch.status && !["active", "suspended", "inactive"].includes(String(patch.status))) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const service = await createServiceClient();
  if (!service) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await service
    .from("agents")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
