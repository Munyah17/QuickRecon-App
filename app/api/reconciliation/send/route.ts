import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import {
  documentToCSV,
  documentsToWorkbook,
  documentsToPDF,
  documentToHTML,
  documentToSMS,
  type AgentReconDocument,
} from "@/lib/reconciliation/document";
import { sendEmail, brandedEmail } from "@/lib/email/send";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { moduleName } from "@/lib/format";

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

    // Real-time mode: no synthetic fallback — the batch must exist.
    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No reconciliation documents found for this agent in this batch. Generate the batch first." },
        { status: 404 }
      );
    }

    // Group docs by module — Econet and Enpassent each get their own
    // consolidated workbook + PDF, all attached to ONE email.
    const byModule = new Map<string, AgentReconDocument[]>();
    for (const d of docs) {
      const key = d.module || "enpassent";
      byModule.set(key, [...(byModule.get(key) ?? []), d]);
    }

    const doc = docs.find((d) => d.currency === "ZWG") ?? docs[0];
    const summary = documentToSMS(doc);
    const html = brandedEmail(documentToHTML(doc), doc.agentName);
    const moduleList = [...byModule.keys()].map(moduleName).join(" + ");
    const text = [
      `Dear ${doc.agentName},`,
      ``,
      `Your ${doc.period} reconciliation reports are attached (${moduleList}).`,
      `Each module includes an Excel workbook and a PDF copy.`,
      ``,
      ...docs.map((d) =>
        `[${moduleName(d.module)} · ${d.currency === "USD" ? "USD" : "ZiG"}] Insurance: ${d.insurance.toLocaleString()} | Zinara: ${d.zinara.toLocaleString()} | Expected: ${d.totalExpected.toLocaleString()} | Deposits: ${d.deposits.toLocaleString()} | Closing: ${d.closingVariance.toLocaleString()}`
      ),
      ``,
      `Regards,`,
      `Kareem — QuickRecon App`,
      `Enpassent (Private) Limited, Harare, Zimbabwe`,
    ].join("\n");
    const subject = `QuickRecon Reconciliation — ${doc.period} (${moduleList})`;

    const delivered: string[] = [];
    const failures: string[] = [];

    if (channels.includes("email") && agentEmail) {
      try {
        const attachments: { filename: string; content: Buffer }[] = [];
        for (const [mod, modDocs] of byModule) {
          const slug = mod.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "module";
          attachments.push({
            filename: `${slug}-reconciliation-${doc.agentId}-${doc.period}.xlsx`,
            content: await documentsToWorkbook(modDocs),
          });
          attachments.push({
            filename: `${slug}-reconciliation-${doc.agentId}-${doc.period}.pdf`,
            content: await documentsToPDF(modDocs),
          });
        }
        const result = await sendEmail({
          to: agentEmail,
          subject,
          text,
          html,
          attachments,
        });
        if (result.ok) delivered.push("email");
        else failures.push("email");
      } catch {
        failures.push("email");
      }
    }

    if (channels.includes("whatsapp") && agentPhone) {
      const wa = getWhatsAppProvider();
      let waOk = false;
      for (const [mod, modDocs] of byModule) {
        const slug = mod.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "module";
        const modDoc = modDocs.find((d) => d.currency === "ZWG") ?? modDocs[0];
        const csv = documentToCSV(modDoc);
        const result = await wa.sendDocument(agentPhone, {
          buffer: Buffer.from(csv, "utf-8"),
          fileName: `${slug}-reconciliation-${doc.agentId}-${doc.period}.csv`,
          caption: `${moduleName(mod)} — ${documentToSMS(modDoc).slice(0, 200)}`,
        });
        waOk = waOk || result.ok;
      }
      if (waOk) delivered.push("whatsapp");
      else failures.push("whatsapp");
    }

    if (channels.includes("sms") && agentPhone) {
      const smsRes = await fetch(`${request.nextUrl.origin}/api/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
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
