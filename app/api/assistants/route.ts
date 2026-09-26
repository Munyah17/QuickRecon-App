import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/assistants — submit an assistant account request.
 * Agents request an assistant under their own agent id; company staff may
 * create one for any agent. Requests start as `pending` for Super Admin review.
 * Body: { fullName, email, phone, boothId, permissions[], agentId? }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fullName = String(b?.fullName ?? "").trim();
  const email = String(b?.email ?? "").trim();
  const phone = String(b?.phone ?? "").trim();
  const boothId = String(b?.boothId ?? "").trim() || null;
  const permissions = Array.isArray(b?.permissions) ? (b.permissions as string[]) : [];
  if (!fullName || !email) {
    return NextResponse.json({ error: "fullName and email are required" }, { status: 400 });
  }

  // Resolve which agent this assistant belongs to.
  const company = isCompanyRole(session.user.role);
  let agentId = String(b?.agentId ?? "").trim();
  if (!company) {
    // Agents/assistants can only request under their own agent id.
    const { data: me } = await sb.from("agents").select("id").eq("user_id", session.user.id).maybeSingle();
    agentId = me?.id ?? "";
    if (!agentId) return NextResponse.json({ error: "No agent profile for this account" }, { status: 403 });
  }
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const { data: agent } = await sb.from("agents").select("id").eq("id", agentId).maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const { data: rows } = await sb.from("assistants").select("id");
  const max = (rows ?? []).reduce((m, r) => {
    const n = parseInt(String(r.id).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const id = `AST-${String(max + 1).padStart(4, "0")}`;

  const { data, error } = await sb.from("assistants").insert({
    id,
    agent_id: agentId,
    booth_id: boothId,
    full_name: fullName,
    email,
    phone: phone || null,
    status: "pending",
    requested_permissions: permissions,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assistant: data }, { status: 201 });
}
