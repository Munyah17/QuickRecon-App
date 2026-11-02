import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { deliverAgentRecon } from "@/lib/reconciliation/deliver";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isCompanyRole(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, channels = ["email", "whatsapp"], senderId = "QuickRecon" } = body;
    let { batchId } = body;

    if (!batchId || !agentId) {
      return NextResponse.json({ error: "Missing batchId or agentId" }, { status: 400 });
    }

    const sb = await createServiceClient();

    // Callers sometimes pass a reconciliations row id (RCN-…) instead of the
    // batch id stored on reconciliation_documents.batch_id. Resolve it so a
    // send never 404s on a valid-looking request.
    if (sb) {
      const { data: probe } = await sb
        .from("reconciliation_documents")
        .select("id")
        .eq("batch_id", batchId)
        .eq("agent_id", agentId)
        .limit(1);
      if (!probe?.length) {
        const { data: reconRow } = await sb
          .from("reconciliations")
          .select("batch_id")
          .eq("id", batchId)
          .maybeSingle();
        if (reconRow?.batch_id) batchId = reconRow.batch_id;
      }
    }

    // Idempotency guard — refuse a second send to the same agent within 5 min.
    if (sb) {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await sb
        .from("reconciliation_deliveries")
        .select("id")
        .eq("batch_id", batchId)
        .eq("agent_id", agentId)
        .eq("status", "sent")
        .gte("delivered_at", cutoff)
        .limit(1);
      if (recent?.length) {
        return NextResponse.json({
          success: true,
          delivered: [],
          failures: [],
          skipped: "duplicate",
          agentId,
          batchId,
        });
      }
    }

    if (!sb) {
      return NextResponse.json(
        { error: "No reconciliation documents found for this agent in this batch. Generate the batch first." },
        { status: 404 }
      );
    }

    const result = await deliverAgentRecon({
      sb,
      batchId,
      agentId,
      channels,
      senderId,
      origin: request.nextUrl.origin,
      cookie: request.headers.get("cookie") ?? "",
      deliveredBy: session.user.id,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Send reconciliation error:", error);
    return NextResponse.json({ error: "Failed to send reconciliation document" }, { status: 500 });
  }
}
