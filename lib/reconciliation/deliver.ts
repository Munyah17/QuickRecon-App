import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentsToWorkbook,
  documentsToPDF,
  documentToHTML,
  documentToSMS,
  type AgentReconDocument,
} from "./document";
import { sendEmail, brandedEmail } from "@/lib/email/send";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { moduleName } from "@/lib/format";

/** Load a batch's stored docs for one agent (USD + ZiG) as render inputs. */
export async function loadAgentDocs(
  sb: SupabaseClient,
  batchId: string,
  agentId: string
): Promise<{ docs: AgentReconDocument[]; agentEmail?: string; agentPhone?: string }> {
  const { data } = await sb
    .from("reconciliation_documents")
    .select("*, agents!inner(email, phone)")
    .eq("batch_id", batchId)
    .eq("agent_id", agentId);

  if (!data?.length) return { docs: [] };
  const docs = data.map((d: Record<string, unknown>) => ({
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
  return { docs, agentEmail: first.agents?.email, agentPhone: first.agents?.phone };
}

export interface DeliverResult {
  success: boolean;
  delivered: string[];
  failures: { channel: string; error: string }[];
  skipped: string[];
  agentId: string;
  batchId: string;
  error?: string;
}

/**
 * Deliver one agent's reconciliation documents over the requested channels.
 * Shared by /api/reconciliation/send and the monthly auto-run cron — both
 * need identical behaviour, so the channel orchestration lives here once.
 */
export async function deliverAgentRecon(opts: {
  sb: SupabaseClient;
  batchId: string;
  agentId: string;
  channels: string[];
  senderId?: string;
  /** Base URL for internal fetches (SMS endpoint). */
  origin: string;
  /** Cookie header to forward to internal endpoints (empty for cron). */
  cookie?: string;
  /** profiles.id of the operator; null for the scheduler. */
  deliveredBy: string | null;
}): Promise<DeliverResult> {
  const { sb, batchId, agentId, channels, senderId = "QuickRecon", origin, cookie, deliveredBy } = opts;

  const { docs, agentEmail, agentPhone } = await loadAgentDocs(sb, batchId, agentId);
  if (docs.length === 0) {
    return {
      success: false,
      delivered: [],
      failures: [],
      skipped: [],
      agentId,
      batchId,
      error: "No reconciliation documents found for this agent in this batch. Generate the batch first.",
    };
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
  const failures: { channel: string; error: string }[] = [];
  const skipped: string[] = [];

  if (channels.includes("email")) {
    if (!agentEmail) {
      skipped.push("email: agent has no email on record");
    } else {
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
        const result = await sendEmail({ to: agentEmail, subject, text, html, attachments });
        if (result.ok) delivered.push("email");
        else failures.push({ channel: "email", error: result.error ?? "send failed" });
      } catch (e) {
        failures.push({ channel: "email", error: e instanceof Error ? e.message : "send failed" });
      }
    }
  }

  if (channels.includes("whatsapp")) {
    if (!agentPhone) {
      skipped.push("whatsapp: agent has no phone on record");
    } else {
      const wa = getWhatsAppProvider();
      let waOk = false;
      let waErr = "provider error";
      for (const [mod, modDocs] of byModule) {
        const slug = mod.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "module";
        const modDoc = modDocs.find((d) => d.currency === "ZWG") ?? modDocs[0];
        const result = await wa.sendDocument(agentPhone, {
          buffer: Buffer.from(await documentsToWorkbook(modDocs)),
          fileName: `${slug}-reconciliation-${doc.agentId}-${doc.period}.xlsx`,
          caption: `${moduleName(mod)} — ${documentToSMS(modDoc).slice(0, 200)}`,
        });
        waOk = waOk || result.ok;
        if (!result.ok && result.error) waErr = result.error;
      }
      if (waOk) delivered.push("whatsapp");
      else failures.push({ channel: "whatsapp", error: waErr });
    }
  }

  if (channels.includes("sms")) {
    if (!agentPhone) {
      skipped.push("sms: agent has no phone on record");
    } else {
      const smsRes = await fetch(`${origin}/api/sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookie ?? "",
        },
        body: JSON.stringify({ recipients: [agentPhone], message: summary, senderId }),
      });
      if (smsRes.ok) {
        delivered.push("sms");
      } else {
        const err = await smsRes.json().catch(() => ({}));
        failures.push({ channel: "sms", error: (err as { error?: string }).error ?? `HTTP ${smsRes.status}` });
      }
    }
  }

  await sb.from("reconciliation_deliveries").insert({
    batch_id: batchId,
    agent_id: agentId,
    channels: delivered,
    delivered_at: new Date().toISOString(),
    delivered_by: deliveredBy,
    status: delivered.length === 0 ? "failed" : failures.length === 0 ? "sent" : "partial",
  });

  return {
    success: delivered.length > 0,
    delivered,
    failures,
    skipped,
    agentId,
    batchId,
  };
}
