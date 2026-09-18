import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import {
  documentToCSV,
  documentsToWorkbook,
  batchToWorkbook,
  type AgentReconDocument,
} from "@/lib/reconciliation/document";

export const runtime = "nodejs";

// JSONB columns can come back as strings depending on how the row was
// written — parse them so the workbook builder always gets objects/arrays.
const asObj = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : (v ?? {}));
const asArr = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : (v ?? []));

function mapDoc(d: Record<string, unknown>): AgentReconDocument {
  return {
    agentId: d.agent_id,
    agentName: d.agent_name,
    module: d.module,
    period: d.period,
    currency: d.currency,
    generatedAt: d.created_at,
    openingVariance: Number(d.opening_variance),
    insurance: Number(d.insurance),
    premiumCover: Number(d.premium_cover),
    commission: Number(d.commission),
    netInsurance: Number(d.net_insurance),
    zinara: Number(d.zinara),
    pds: Number(d.pds),
    insurancePds: Number(d.insurance_pds ?? d.pds ?? 0),
    zinaraPds: Number(d.zinara_pds ?? 0),
    totalExpected: Number(d.total_expected),
    bankDeposits: asObj(d.bank_deposits),
    deposits: Number(d.deposits),
    adjustments: Number(d.adjustments),
    closingVariance: Number(d.closing_variance),
    closingPosition: Number(d.closing_position),
    status: d.status,
    transactions: asArr(d.transactions),
    lines: [],
    summaryText: d.summary_text ?? "",
  } as unknown as AgentReconDocument;
}

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
  const moduleParam = searchParams.get("module");
  const format = searchParams.get("format") ?? "xlsx";

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  // ── Batch export: every agent in the Consolidated-A summary layout ──
  if (agentId === "all") {
    if (!isCompanyRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let q = sb.from("reconciliation_documents").select("*");
    if (batchId) q = q.eq("batch_id", batchId);
    if (period) q = q.eq("period", period);
    if (moduleParam && moduleParam !== "all") q = q.eq("module", moduleParam);
    const { data } = await q.order("agent_id").order("currency");
    if (!data?.length) {
      return NextResponse.json({ error: "No documents found" }, { status: 404 });
    }
    try {
      const xlsx = await batchToWorkbook(data.map(mapDoc));
      return new NextResponse(new Uint8Array(xlsx), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="reconciliation-breakdowns${period ? `-${period}` : ""}.xlsx"`,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to generate workbook" },
        { status: 500 }
      );
    }
  }

  // Per-agent isolation — field users can never pull another agent's doc.
  if (!isCompanyRole(session.user.role) && session.user.agentId !== agentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load every currency doc for this agent (USD + ZiG) — dual-currency workbook.
  let q = sb.from("reconciliation_documents").select("*").eq("agent_id", agentId);
  if (batchId) q = q.eq("batch_id", batchId);
  if (period) q = q.eq("period", period);
  const { data } = await q.order("created_at", { ascending: false });

  if (!data?.length) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const docs: AgentReconDocument[] = data.map(mapDoc);
  const primary = docs.find((d) => d.currency === "ZWG") ?? docs[0];
  const fname = `reconciliation-${primary.agentId}-${primary.period}`;

  if (format === "csv") {
    const stored = data.find((d: Record<string, unknown>) => d.csv_text) as Record<string, unknown> | undefined;
    const csv = (stored?.csv_text as string) ?? documentToCSV(primary);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}.csv"`,
      },
    });
  }

  try {
    const xlsx = await documentsToWorkbook(docs);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("reconciliation download failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate workbook" },
      { status: 500 }
    );
  }
}
