/**
 * End-to-end test: build one real agent reconciliation document in the
 * client's format (Summary sheet + Consolidated A + transactions), then
 * email it via SMTP to the distribution list. MOCK-DATA disclaimer included.
 * Run: node scripts/test-send-recon.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");

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

const RECIPIENTS = [
  "leon@enpassent.co.zw",
  "cady@motions.co.zw",
  "insurer.shocks11@gmail.com",
  "munyamuzvidziwa19@gmail.com",
  "harold@enpassent.co.zw",
  "a.antipas@enpassent.co.zw",
  "info@motions.co.zw",
  "admin@enpassent.co.zw",
  "innocent@enpassent.co.zw",
];

// --- Musa Zhou — real August 2026 RECON row from the source workbook ---------
const doc = {
  agentId: "AGT-000184",
  agentName: "Musa Zhou",
  module: "enpassent",
  period: "2026-08",
  currency: "ZWG",
  openingVariance: 8176.23,
  insurance: 100065.98,
  premiumCover: 84325.61,
  commission: 8432.56,
  netInsurance: 91633.42,
  zinara: 154112,
  pds: 0,
  totalExpected: 385157.65,
  bankDeposits: { NMB: 304993.24, NBS: 0, CBZ: 0, Transfers: 39804.4, "USD": 0, "NMB USD": 8120 },
  deposits: 304993.24 + 39804.4 + 8120,
  adjustments: 1568,
  closingVariance: 30672.01,
  status: "warning",
  transactions: [
    { date: "2026-08-01", agentName: "Musa Zhou", amount: 3837.88, bankAccount: "Ecocash", narration: "T4472586", reference: "TRN-46030" },
    { date: "2026-08-20", agentName: "Musa Zhou", amount: 1015, bankAccount: "Ecocash", narration: "T2071716", reference: "TRN-46041" },
    { date: "2026-08-21", agentName: "Musa Zhou", amount: 3365.76, bankAccount: "Ecocash", narration: "T9610489", reference: "TRN-46089" },
    { date: "2026-08-25", agentName: "Musa Zhou", amount: 13000, bankAccount: "CBZ", narration: "CBZ deposit", reference: "CBZ-0813" },
    { date: "2026-08-25", agentName: "Musa Zhou", amount: 1300, bankAccount: "CBZ", narration: "CBZ deposit", reference: "CBZ-0814" },
    { date: "2026-08-28", agentName: "Musa Zhou", amount: 10000, bankAccount: "Nedbank", narration: "Bank transfer", reference: "NDB-46089" },
    { date: "2026-08-30", agentName: "Musa Zhou", amount: 1965.76, bankAccount: "Ecocash", narration: "T7832617", reference: "TRN-46120" },
    { date: "2026-08-31", agentName: "Musa Zhou", amount: 5320, bankAccount: "CBZ", narration: "CBZ deposit", reference: "CBZ-46181" },
  ],
};

const BANK_CHANNELS = ["Ecocash", "STEWARD", "NBS", "Transfers", "USD", "CBZ", "NMB"];

// --- workbook: Sheet1 = Summary dashboard, Sheet2 = Consolidated A + txns ----
function buildXLSX(d) {
  const summary = [
    ["QuickRecon — Consolidated Revenue Report"], [],
    ["Agent", d.agentName], ["Agent ID", d.agentId], ["Module", "Enpassent"],
    ["Period", d.period], ["Currency", d.currency],
    ["Generated", new Date().toISOString()],
    ["Status", "Variance — review"], [],
    ["Metric", `Amount (${d.currency})`],
    ["Opening Variance", d.openingVariance], ["Insurance", d.insurance],
    ["Premium Cover", d.premiumCover], ["Commission", d.commission],
    ["Net Insurance", d.netInsurance], ["Zinara", d.zinara],
    ["Total Expected", d.totalExpected], ["Total Deposits", d.deposits],
    ["Alterations", d.adjustments], ["Closing Variance", d.closingVariance], [],
    ["Deposit Channels", ""],
    ...Object.entries(d.bankDeposits).filter(([, v]) => v !== 0), [],
    ["Summary", `A variance of ${d.currency} ${d.closingVariance.toLocaleString()} was detected. Please review the detail below.`],
    [],
    ["DISCLAIMER", "MOCK DATA for testing only — not a real statement. Live data is pushed at launch."],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 24 }, { wch: 60 }];

  const detail = [
    ["Currency","Agent Name","Opening Variance","Insurance","Premium Cover","Commission","Net Insurance","Zinara","Pds","Total Expected",...BANK_CHANNELS,"Alterations","Closing Variance"],
    [d.currency,d.agentName,d.openingVariance,d.insurance,d.premiumCover,d.commission,d.netInsurance,d.zinara,d.pds||"",d.totalExpected,...BANK_CHANNELS.map(b=>d.bankDeposits[b]??""),d.adjustments||"",d.closingVariance],
    [], ["Transaction Detail"],
    ["Date","Agent","Amount","USD-ZWG Conversion","Bank/Account","Narration/Ref","Reference"],
    ...d.transactions.map(t=>[t.date,t.agentName,t.amount,"",t.bankAccount,t.narration,t.reference]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detail);
  ws2["!cols"] = [{wch:12},{wch:26},{wch:12},{wch:12},{wch:18},{wch:24},{wch:14}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");
  XLSX.utils.book_append_sheet(wb, ws2, "Consolidated A");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// --- branded HTML ------------------------------------------------------------
function emailHTML(d) {
  const txnRows = d.transactions.map(t=>`<tr><td style="padding:5px;border:1px solid #ddd;">${t.date}</td><td style="padding:5px;border:1px solid #ddd;">${t.agentName}</td><td style="text-align:right;padding:5px;border:1px solid #ddd;">${t.amount.toLocaleString()}</td><td style="padding:5px;border:1px solid #ddd;">${t.bankAccount}</td><td style="padding:5px;border:1px solid #ddd;">${t.narration}</td></tr>`).join("");
  const body = `
    <h2 style="margin-top:0;color:#0f2b4c;">Consolidated Revenue Report — ${d.period}</h2>
    <p><strong>Agent:</strong> ${d.agentName} (${d.agentId}) &nbsp; <strong>Currency:</strong> ${d.currency}</p>
    <p>A variance of <strong>${d.currency} ${d.closingVariance.toLocaleString()}</strong> was detected. Please review the attached workbook.</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px;">
      <tr style="background:#f3f4f6;">
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Opening</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Insurance</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Commission</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Net Insurance</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Zinara</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Total Expected</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Deposits</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Closing Var.</th>
      </tr>
      <tr>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.openingVariance.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.insurance.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.commission.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.netInsurance.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.zinara.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.totalExpected.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;">${d.deposits.toLocaleString()}</td>
        <td style="text-align:right;padding:5px;border:1px solid #ddd;"><strong>${d.closingVariance.toLocaleString()}</strong></td>
      </tr>
    </table>
    <h3 style="margin-top:16px;color:#0f2b4c;">Transaction Detail</h3>
    <table style="border-collapse:collapse;width:100%;font-size:12px;">
      <tr style="background:#f3f4f6;">
        <th style="text-align:left;padding:5px;border:1px solid #ddd;">Date</th>
        <th style="text-align:left;padding:5px;border:1px solid #ddd;">Agent</th>
        <th style="text-align:right;padding:5px;border:1px solid #ddd;">Amount</th>
        <th style="text-align:left;padding:5px;border:1px solid #ddd;">Bank</th>
        <th style="text-align:left;padding:5px;border:1px solid #ddd;">Narration</th>
      </tr>${txnRows}
    </table>`;
  return `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
      <div style="background:#0f2b4c;border-radius:12px 12px 0 0;padding:18px 24px;">
        <span style="color:#fff;font-size:16px;font-weight:bold;">QuickRecon App</span>
        <span style="color:#9fb8d4;font-size:11px;float:right;padding-top:4px;">Reconciliation Report</span>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">${body}
        <p style="margin-top:16px;padding:10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;font-size:12px;color:#92400e;">
          <strong>TEST DATA:</strong> This is mock reconciliation data for system testing — not a real statement. Actual data is pushed at launch.
        </p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 24px;">
        <p style="margin:0;font-size:12px;color:#374151;">Regards,<br><strong>Kareem</strong> — QuickRecon App<br><span style="color:#6b7280;">Automated reconciliation reports</span></p>
        <p style="margin:10px 0 0;font-size:10.5px;color:#9ca3af;">Confidential — intended only for the named recipient. &copy; Enpassent (Private) Limited — Harare, Zimbabwe.</p>
      </div>
    </div></body></html>`;
}

// --- send --------------------------------------------------------------------
const xlsx = buildXLSX(doc);
const tx = nodemailer.createTransport({
  host: env.SMTP_HOST, port: Number(env.SMTP_PORT ?? 465),
  secure: env.SMTP_SECURE === "true",
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

for (const to of RECIPIENTS) {
  try {
    const info = await tx.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `QuickRecon Reconciliation — ${doc.agentName} (${doc.period})`,
      text: `QuickRecon ${doc.period} reconciliation for ${doc.agentName}: variance ${doc.currency} ${doc.closingVariance.toLocaleString()}. MOCK DATA for testing. See attached workbook.`,
      html: emailHTML(doc),
      attachments: [{ filename: `reconciliation-${doc.agentId}-${doc.period}.xlsx`, content: xlsx }],
      headers: { "X-Mailer": "QuickRecon App", "List-Unsubscribe": `<mailto:${env.SMTP_USER}?subject=unsubscribe>` },
    });
    console.log(`OK  ${to} — ${info.messageId}`);
  } catch (e) {
    console.log(`FAIL ${to} — ${e.message}`);
  }
}
console.log("Done.");
