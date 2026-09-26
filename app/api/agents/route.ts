import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/agents — company staff list all agents (directory). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await sb
    .from("agents")
    .select("id, full_name, email, phone, province, location, status, national_id, icecash_id, kyc_status, joined_at")
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Real per-agent financials aggregated from reconciliation documents —
  // commission earned, deposits received and latest closing position. These
  // replace the fabricated float/bonus/sales figures the directory used to show.
  const { data: docs } = await sb
    .from("reconciliation_documents")
    .select("agent_id, commission, deposits, closing_position");
  const fin = new Map<string, { commission: number; deposits: number; closing: number }>();
  for (const d of docs ?? []) {
    const cur = fin.get(d.agent_id) ?? { commission: 0, deposits: 0, closing: 0 };
    cur.commission += Number(d.commission) || 0;
    cur.deposits += Number(d.deposits) || 0;
    cur.closing += Number(d.closing_position) || 0;
    fin.set(d.agent_id, cur);
  }

  const agents = (data ?? []).map((a) => ({
    ...a,
    commission: fin.get(a.id)?.commission ?? 0,
    deposits: fin.get(a.id)?.deposits ?? 0,
    closing_position: fin.get(a.id)?.closing ?? 0,
  }));
  return NextResponse.json({ agents });
}
