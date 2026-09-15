/**
 * End-to-end test: build one real agent reconciliation document, persist it
 * to Supabase (reconciliation_documents), then send it via SMTP email.
 * Run: node scripts/test-send-recon.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");

// --- env -------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// --- the document (one agent, real figures) --------------------------------
const doc = {
  agentId: "AGT-000184",
  agentName: "Musa Zhou",
  module: "enpassent",
  period: "2026-01",
  currency: "ZWG",
  openingVariance: 0,
  insurance: 125000,
  premiumCover: 0,
  commission: 12500,
  netInsurance: 112500,
  zinara: 45000,
  pds: 0,
  totalExpected: 170000,
  bankDeposits: { "CBZ ****4521": 100000, "Cash": 50000 },
  deposits: 150000,
  adjustments: 0,
  closingVariance: 20000,
  closingPosition: 20000,
  status: "warning",
  transactions: [
    { date: "2026-01-05", agentName: "Musa Zhou", amount: 40000, usdAmount: null, usdConversionRate: null, bankAccount: "CBZ ****4521", narration: "Policy premiums — week 1", reference: "INS-2601-01" },
    { date: "2026-01-12", agentName: "Musa Zhou", amount: 45000, usdAmount: null, usdConversionRate: null, bankAccount: "CBZ ****4521", narration: "Policy premiums — week 2", reference: "INS-2601-02" },
    { date: "2026-01-19", agentName: "Musa Zhou", amount: 40000, usdAmount: null, usdConversionRate: null, bankAccount: "CBZ ****4521", narration: "Policy premiums — week 3", reference: "INS-2601-03" },
    { date: "2026-01-28", agentName: "Musa Zhou", amount: 25000, usdAmount: null, usdConversionRate: null, bankAccount: "Cash", narration: "ZINARA remittance — cash deposit", reference: "ZNR-2601-01" },
    { date: "2026-01-30", agentName: "Musa Zhou", amount: 25000, usdAmount: null, usdConversionRate: null, bankAccount: "Cash", narration: "End-month cash settlement", reference: "DEP-2601-04" },
  ],
};

const BANK_CHANNELS = Object.keys(doc.bankDeposits);

function toCSV(d) {
  const header = ["Currency","Agent Name","Opening Variance","Insurance","Premium Cover","Commission","Net Insurance","Zinara","Pds","Total Expected",...BANK_CHANNELS,"Alterations","Closing Variance"];
  const data = [d.currency,d.agentName,d.openingVariance,d.insurance,d.premiumCover,d.commission,d.netInsurance,d.zinara,d.pds,d.totalExpected,...BANK_CHANNELS.map(b=>d.bankDeposits[b]??0),d.adjustments,d.closingVariance];
  const rows = [
    ["QuickRecon Consolidated Revenue Report"],
    ["Agent", d.agentName], ["Agent ID", d.agentId], ["Module", d.module], ["Period", d.period], ["Generated", new Date().toISOString()],
    [], header, data,
    [], ["Transaction Detail"],
    ["Date","Agent","Amount","USD Amount","USD-ZWG Conversion","Bank/Account","Narration/Ref","Reference"],
    ...d.transactions.map(t=>[t.date,t.agentName,t.amount,t.usdAmount??"",t.usdConversionRate??"",t.bankAccount,t.narration,t.reference]),
  ];
  return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
}

function toHTML(d) {
  const bankHead = BANK_CHANNELS.map(b=>`<th style="text-align:right;padding:6px;border:1px solid #ddd;">${b}</th>`).join("");
  const bankData = BANK_CHANNELS.map(b=>`<td style="text-align:right;padding:6px;border:1px solid #ddd;">${(d.bankDeposits[b]??0).toLocaleString()}</td>`).join("");
  const txnRows = d.transactions.map(t=>`<tr><td style="padding:6px;border:1px solid #ddd;">${t.date}</td><td style="padding:6px;border:1px solid #ddd;">${t.agentName}</td><td style="text-align:right;padding:6px;border:1px solid #ddd;">${t.amount.toLocaleString()}</td><td style="padding:6px;border:1px solid #ddd;">${t.bankAccount}</td><td style="padding:6px;border:1px solid #ddd;">${t.narration}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
    <h2>Consolidated Revenue Report — ${d.period}</h2>
    <p><strong>Agent:</strong> ${d.agentName} (${d.agentId}) &nbsp; <strong>Currency:</strong> ${d.currency}</p>
    <p>A variance of ZWG ${Math.abs(d.closingVariance).toLocaleString()} was detected. Please review the attached detail.</p>
    <table style="border-collapse:collapse;width:100%;max-width:900px;margin-top:12px;">
      <tr style="background:#f3f4f6;">
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Opening Variance</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Insurance</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Premium Cover</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Commission</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Net Insurance</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Zinara</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Total Expected</th>
        ${bankHead}
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Alterations</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Closing Variance</th>
      </tr>
      <tr>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.openingVariance.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.insurance.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.premiumCover.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.commission.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.netInsurance.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.zinara.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.totalExpected.toLocaleString()}</td>
        ${bankData}
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.adjustments.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${d.closingVariance.toLocaleString()}</td>
      </tr>
    </table>
    <h3 style="margin-top:20px;">Transaction Detail</h3>
    <table style="border-collapse:collapse;width:100%;max-width:900px;">
      <tr style="background:#f3f4f6;">
        <th style="text-align:left;padding:6px;border:1px solid #ddd;">Date</th>
        <th style="text-align:left;padding:6px;border:1px solid #ddd;">Agent</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Amount</th>
        <th style="text-align:left;padding:6px;border:1px solid #ddd;">Bank/Account</th>
        <th style="text-align:left;padding:6px;border:1px solid #ddd;">Narration</th>
      </tr>
      ${txnRows}
    </table>
    <p style="margin-top:16px;">This document is confidential and intended for ${d.agentName} only.</p>
  </div>`;
}

const CREATED_BY = "bfda052a-d8c2-40ca-9e16-febaeedf8d43"; // munyamuzvidziwa19 super_admin
const BATCH_ID = `RCN-BATCH-${doc.period}-${Date.now().toString(36)}`;
const RECON_ID = `RCN-${doc.period.replace("-", "")}-001`;

// --- persist to Supabase ----------------------------------------------------
async function persist() {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

  // 1. batch
  const b = await fetch(`${SB_URL}/rest/v1/reconciliation_batches`, {
    method: "POST", headers: h,
    body: JSON.stringify({ id: BATCH_ID, module: doc.module, period: doc.period, status: "published", created_by: CREATED_BY, approved_by: CREATED_BY, approved_at: new Date().toISOString(), published_at: new Date().toISOString() }),
  });
  if (!b.ok) { console.error("batch insert failed:", await b.json()); return null; }

  // 2. reconciliation row
  const r = await fetch(`${SB_URL}/rest/v1/reconciliations`, {
    method: "POST", headers: h,
    body: JSON.stringify({ id: RECON_ID, batch_id: BATCH_ID, agent_id: doc.agentId, module: doc.module, period: doc.period, status: "published", currency: doc.currency, opening_position: doc.openingVariance, insurance: doc.insurance, zinara: doc.zinara, deposits: doc.deposits, adjustments: doc.adjustments, closing_position: doc.closingPosition, published_at: new Date().toISOString() }),
  });
  if (!r.ok) { console.error("recon insert failed:", await r.json()); return null; }

  // 3. document
  const res = await fetch(`${SB_URL}/rest/v1/reconciliation_documents`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      batch_id: BATCH_ID,
      agent_id: doc.agentId,
      agent_name: doc.agentName,
      module: doc.module,
      period: doc.period,
      currency: doc.currency,
      opening_variance: doc.openingVariance,
      insurance: doc.insurance,
      premium_cover: doc.premiumCover,
      commission: doc.commission,
      net_insurance: doc.netInsurance,
      zinara: doc.zinara,
      pds: doc.pds,
      total_expected: doc.totalExpected,
      bank_deposits: doc.bankDeposits,
      deposits: doc.deposits,
      adjustments: doc.adjustments,
      closing_variance: doc.closingVariance,
      closing_position: doc.closingPosition,
      status: doc.status,
      transactions: doc.transactions,
      summary_text: `A variance of ZWG ${doc.closingVariance.toLocaleString()} was detected.`,
    }),
  });
  const body = await res.json();
  if (!res.ok) { console.error("Supabase insert failed:", res.status, body); return null; }
  console.log("Supabase: document persisted", body[0]?.id ?? body);
  return body[0]?.id ?? null;
}

// --- send email -------------------------------------------------------------
async function send() {
  const tx = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 465),
    secure: env.SMTP_SECURE === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const csv = toCSV(doc);
  const html = toHTML(doc);
  const info = await tx.sendMail({
    from: env.SMTP_FROM,
    to: "munyah777@gmail.com",
    subject: `QuickRecon Reconciliation — ${doc.agentName} (${doc.period})`,
    text: `QuickRecon ${doc.period} reconciliation for ${doc.agentName}: variance ZWG ${doc.closingVariance.toLocaleString()}. See attached CSV.`,
    html,
    attachments: [{ filename: `reconciliation-${doc.agentId}-${doc.period}.csv`, content: Buffer.from(csv, "utf-8") }],
  });
  console.log("Email sent:", info.messageId, info.response);
}

const docId = await persist();
await send();
console.log("Done. Document id:", docId);
