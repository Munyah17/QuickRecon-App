import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import {
  documentToCSV,
  documentToHTML,
  documentToSMS,
  type AgentReconDocument,
} from "@/lib/reconciliation/document";
import { sendEmail } from "@/lib/email/send";
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
    let doc: AgentReconDocument | null = null;
    let agentEmail: string | undefined;
    let agentPhone: string | undefined;

    if (sb) {
      const { data } = await sb
        .from("reconciliation_documents")
        .select("*, agents!inner(email, phone)")
        .eq("batch_id", batchId)
        .eq("agent_id", agentId)
        .single();

      if (data) {
        doc = {
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
        agentEmail = data.agents?.email;
        agentPhone = data.agents?.phone;
      }
    }

    // Fallback: rebuild a synthetic document for demo / when Supabase is not configured.
    if (!doc) {
      const { getAgentById } = await import("@/lib/data");
      const agent = await getAgentById(agentId);
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      doc = {
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
      agentEmail = agent.email;
      agentPhone = agent.phone;
    }

    const summary = documentToSMS(doc);
    const csv = documentToCSV(doc);
    const html = documentToHTML(doc);
    const subject = `QuickRecon Reconciliation — ${doc.period}`;

    const delivered: string[] = [];
    const failures: string[] = [];

    if (channels.includes("email") && agentEmail) {
      const result = await sendEmail({
        to: agentEmail,
        subject,
        text: summary,
        html,
        attachments: [
          {
            filename: `reconciliation-${doc.agentId}-${doc.period}.csv`,
            content: Buffer.from(csv, "utf-8"),
          },
        ],
      });
      if (result.ok) delivered.push("email");
      else failures.push("email");
    }

    if (channels.includes("whatsapp") && agentPhone) {
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
