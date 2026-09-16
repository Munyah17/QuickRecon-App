import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import {
  documentToCSV,
  documentsToWorkbook,
  documentToHTML,
  documentToSMS,
  type AgentReconDocument,
} from "@/lib/reconciliation/document";
import { sendEmail, brandedEmail } from "@/lib/email/send";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isCompanyRole(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { batchId, agentId, channels = ["email", "whatsapp"], senderId = "QuickRecon" } = body;

    if (!batchId || !agentId) {
      return NextResponse.json({ error: "Missing batchId or agentId" }, { status: 400 });
    }

    const sb = await createServiceClient();

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

    let agentEmail: string | undefined;
    let agentPhone: string | undefined;

    let docs: AgentReconDocument[] = [];
    if (sb) {
      // Load every currency doc for this agent (USD + ZiG) — the workbook
      // is dual-currency, so we need both rows.
      const { data } = await sb
        .from("reconciliation_documents")
        .select("*, agents!inner(email, phone)")
        .eq("batch_id", batchId)
        .eq("agent_id", agentId);

      if (data?.length) {
        docs = data.map((d: Record<string, unknown>) => ({
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
          bankDeposits: d.bank_deposits ?? {},
          deposits: Number(d.deposits),
          adjustments: Number(d.adjustments),
          closingVariance: Number(d.closing_variance),
          closingPosition: Number(d.closing_position),
          status: d.status,
          transactions: d.transactions ?? [],
          lines: [],
          summaryText: d.summary_text ?? "",
        })) as unknown as AgentReconDocument[];
        const first = data[0] as Record<string, unknown> & { agents?: { email?: string; phone?: string } };
        agentEmail = first.agents?.email;
        agentPhone = first.agents?.phone;
      }
    }

    // Fallback: rebuild a synthetic document for demo / when Supabase is not configured.
    if (docs.length === 0) {
      const { getAgentById } = await import("@/lib/data");
      const agent = await getAgentById(agentId);
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      const fallback: AgentReconDocument = {
        agentId: agent.id,
        agentName: agent.fullName,
        module: "enpassent",
        period: "2026-09",
        currency: "ZWG",
        generatedAt: new Date().toISOString(),
        openingVariance: 0,
        insurance: 125000,
        premiumCover: 0,
        commission: 0,
        netInsurance: 125000,
        zinara: 45000,
        pds: 0,
        totalExpected: 170000,
        bankDeposits: {},
        deposits: 150000,
        adjustments: 0,
        closingVariance: 20000,
        closingPosition: 20000,
        status: "warning",
        transactions: [],
        lines: [
          { item: "Insurance", expected: 125000, actual: 125000, variance: 0 },
          { item: "ZINARA", expected: 45000, actual: 45000, variance: 0 },
          { item: "Deposits", expected: 150000, actual: 150000, variance: 0 },
        ],
        summaryText:
          "A variance of ZWG 20,000 was detected. Please review the attached detail.",
      };
      docs = [fallback];
      agentEmail = agent.email;
      agentPhone = agent.phone;
    }

    const doc = docs.find((d) => d.currency === "ZWG") ?? docs[0];
    const summary = documentToSMS(doc);
    const html = brandedEmail(documentToHTML(doc), doc.agentName);
    const text = [
      `Dear ${doc.agentName},`,
      ``,
      `Your ${doc.period} reconciliation report is attached.`,
      ``,
      ...docs.map((d) =>
        `[${d.currency === "USD" ? "USD" : "ZiG"}] Insurance: ${d.insurance.toLocaleString()} | Zinara: ${d.zinara.toLocaleString()} | Expected: ${d.totalExpected.toLocaleString()} | Deposits: ${d.deposits.toLocaleString()} | Closing: ${d.closingVariance.toLocaleString()}`
      ),
      ``,
      `Regards,`,
      `Kareem — QuickRecon App`,
      `Enpassent (Private) Limited, Harare, Zimbabwe`,
    ].join("\n");
    const subject = `QuickRecon Reconciliation — ${doc.period}`;

    const delivered: string[] = [];
    const failures: string[] = [];

    if (channels.includes("email") && agentEmail) {
      const xlsx = await documentsToWorkbook(docs);
      const result = await sendEmail({
        to: agentEmail,
        subject,
        text,
        html,
        attachments: [
          {
            filename: `reconciliation-${doc.agentId}-${doc.period}.xlsx`,
            content: xlsx,
          },
        ],
      });
      if (result.ok) delivered.push("email");
      else failures.push("email");
    }

    if (channels.includes("whatsapp") && agentPhone) {
      const csv = documentToCSV(doc);
      const wa = getWhatsAppProvider();
      const result = await wa.sendDocument(agentPhone, {
        buffer: Buffer.from(csv, "utf-8"),
        fileName: `reconciliation-${doc.agentId}-${doc.period}.csv`,
        caption: summary.slice(0, 240),
      });
      if (result.ok) delivered.push("whatsapp");
      else failures.push("whatsapp");
    }

    if (channels.includes("sms") && agentPhone) {
      const smsRes = await fetch(`${request.nextUrl.origin}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: [agentPhone],
          message: summary,
          senderId,
        }),
      });
      if (smsRes.ok) {
        delivered.push("sms");
      } else {
        failures.push("sms");
      }
    }

    if (sb) {
      await sb.from("reconciliation_deliveries").insert({
        batch_id: batchId,
        agent_id: agentId,
        channels: delivered,
        delivered_at: new Date().toISOString(),
        delivered_by: session.user.id,
        status: failures.length === 0 ? "sent" : delivered.length > 0 ? "partial" : "failed",
      });
    }

    return NextResponse.json({
      success: failures.length === 0 || delivered.length > 0,
      delivered,
      failures,
      agentId,
      batchId,
    });
  } catch (error) {
    console.error("Send reconciliation error:", error);
    return NextResponse.json({ error: "Failed to send reconciliation document" }, { status: 500 });
  }
}
