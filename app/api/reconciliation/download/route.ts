import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import {
  documentToCSV,
  documentToXLSX,
  type AgentReconDocument,
} from "@/lib/reconciliation/document";

export const runtime = "nodejs";

/**
 * Serves the real per-agent reconciliation document (same content that is
 * emailed via /api/reconciliation/send). Company roles may download any
 * document; field users may only download their own.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const batchId = searchParams.get("batchId");
  const agentId = searchParams.get("agentId");
  const period = searchParams.get("period");
  const format = searchParams.get("format") ?? "xlsx";

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  // Per-agent isolation — field users can never pull another agent's doc.
  if (!isCompanyRole(session.user.role) && session.user.agentId !== agentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  let q = sb.from("reconciliation_documents").select("*").eq("agent_id", agentId);
  if (batchId) q = q.eq("batch_id", batchId);
  if (period) q = q.eq("period", period);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const doc: AgentReconDocument = {
    agentId: data.agent_id,
    agentName: data.agent_name,
    module: data.module,
    period: data.period,
    currency: data.currency,
    generatedAt: data.created_at,
    openingVariance: Number(data.opening_variance),
    insurance: Number(data.insurance),
    premiumCover: Number(data.premium_cover),
    commission: Number(data.commission),
    netInsurance: Number(data.net_insurance),
    zinara: Number(data.zinara),
    pds: Number(data.pds),
    totalExpected: Number(data.total_expected),
    bankDeposits: data.bank_deposits ?? {},
    deposits: Number(data.deposits),
    adjustments: Number(data.adjustments),
    closingVariance: Number(data.closing_variance),
    closingPosition: Number(data.closing_position),
    status: data.status,
    transactions: data.transactions ?? [],
    lines: [],
    summaryText: data.summary_text ?? "",
  };

  const fname = `reconciliation-${doc.agentId}-${doc.period}`;

  if (format === "csv") {
    const csv = data.csv_text ?? documentToCSV(doc);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}.csv"`,
      },
    });
  }

  const xlsx = await documentToXLSX(doc);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
    },
  });
}
