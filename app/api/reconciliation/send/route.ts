import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { documentToCSV, documentToHTML, documentToSMS } from "@/lib/reconciliation/document";
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
    let doc: {
      agentId: string;
      agentName: string;
      module: string;
      period: string;
      currency: "ZWG" | "USD";
      openingPosition: number;
      insurance: number;
      zinara: number;
      deposits: number;
      adjustments: number;
      closingPosition: number;
      status: "success" | "warning" | "attention";
      lines: { item: string; expected: number; actual: number; variance: number }[];
      agentEmail?: string;
      agentPhone?: string;
    } | null = null;

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
          openingPosition: data.opening_position,
          insurance: data.insurance,
          zinara: data.zinara,
          deposits: data.deposits,
          adjustments: data.adjustments,
          closingPosition: data.closing_position,
          status: data.status,
          lines: [], // stored as CSV text for now
          agentEmail: data.agents?.email,
          agentPhone: data.agents?.phone,
        };
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
        openingPosition: 0,
        insurance: 125000,
        zinara: 45000,
        deposits: 150000,
        adjustments: 0,
        closingPosition: 20000,
        status: "warning",
        lines: [
          { item: "Insurance", expected: 125000, actual: 125000, variance: 0 },
          { item: "ZINARA", expected: 45000, actual: 45000, variance: 0 },
          { item: "Deposits", expected: 150000, actual: 150000, variance: 0 },
        ],
        agentEmail: agent.email,
        agentPhone: agent.phone,
      };
    }

    const summary = documentToSMS(doc as any);
    const csv = documentToCSV(doc as any);
    const html = documentToHTML(doc as any);
    const subject = `QuickRecon Reconciliation — ${doc.period}`;

    const delivered: string[] = [];
    const failures: string[] = [];

    if (channels.includes("email") && doc.agentEmail) {
      const result = await sendEmail({
        to: doc.agentEmail,
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

    if (channels.includes("whatsapp") && doc.agentPhone) {
      const wa = getWhatsAppProvider();
      const result = await wa.sendDocument(doc.agentPhone, {
        buffer: Buffer.from(csv, "utf-8"),
        fileName: `reconciliation-${doc.agentId}-${doc.period}.csv`,
        caption: summary.slice(0, 240),
      });
      if (result.ok) delivered.push("whatsapp");
      else failures.push("whatsapp");
    }

    if (channels.includes("sms") && doc.agentPhone) {
      const smsRes = await fetch(`${request.nextUrl.origin}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: [doc.agentPhone],
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
