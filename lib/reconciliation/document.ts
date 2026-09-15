import { formatMoney } from "@/lib/format";
import type { Currency } from "@/types";
import type { AgentReconResult, EngineOutput, TransactionDetail } from "./types";
import { BANK_CHANNELS } from "./types";

export interface AgentReconDocument {
  agentId: string;
  agentName: string;
  module: string;
  period: string;
  currency: Currency;
  generatedAt: string;
  openingVariance: number;
  insurance: number;
  premiumCover: number;
  commission: number;
  netInsurance: number;
  zinara: number;
  pds: number;
  totalExpected: number;
  bankDeposits: Record<string, number>;
  deposits: number;
  adjustments: number;
  closingVariance: number;
  closingPosition: number;
  status: "success" | "warning" | "attention";
  transactions: TransactionDetail[];
  lines: {
    item: string;
    expected: number;
    actual: number;
    variance: number;
  }[];
  summaryText: string;
  pdfUrl?: string;
  csvUrl?: string;
}

export interface BatchDocuments {
  batchId: string;
  module: string;
  period: string;
  generatedAt: string;
  documents: AgentReconDocument[];
}

/**
 * Builds one consolidated reconciliation document per agent from engine output.
 * No agent sees another agent's figures — documents are isolated by agentId.
 */
export function generateAgentDocuments(engineOutput: EngineOutput): BatchDocuments {
  const generatedAt = new Date().toISOString();
  const batchId = `RCN-${engineOutput.module}-${engineOutput.period}-${Date.now()}`;

  return {
    batchId,
    module: engineOutput.module,
    period: engineOutput.period,
    generatedAt,
    documents: engineOutput.results.map((r) => buildDocumentForAgent(r, engineOutput, generatedAt)),
  };
}

function buildDocumentForAgent(
  result: AgentReconResult,
  engineOutput: EngineOutput,
  generatedAt: string
): AgentReconDocument {
  const variance = result.closingVariance;
  const summaryText =
    result.status === "success"
      ? `All figures reconciled. Closing variance is ${formatMoney(result.closingVariance, result.currency)}.`
      : result.status === "warning"
        ? `A variance of ${formatMoney(Math.abs(variance), result.currency)} was detected. Please review the attached detail.`
        : `A significant variance of ${formatMoney(Math.abs(variance), result.currency)} requires attention before the next period.`;

  return {
    agentId: result.agentId,
    agentName: result.agentName,
    module: engineOutput.module,
    period: engineOutput.period,
    currency: result.currency,
    generatedAt,
    openingVariance: result.openingVariance,
    insurance: result.insurance,
    premiumCover: result.premiumCover,
    commission: result.commission,
    netInsurance: result.netInsurance,
    zinara: result.zinara,
    pds: result.pds,
    totalExpected: result.totalExpected,
    bankDeposits: result.bankDeposits,
    deposits: result.deposits,
    adjustments: result.adjustments,
    closingVariance: result.closingVariance,
    closingPosition: result.closingPosition,
    status: result.status,
    transactions: result.transactions,
    lines: result.lines,
    summaryText,
  };
}

/**
 * Serialises one agent document to CSV text matching the real Enpassent
 * "Consolidated A" column structure. Private to that agent.
 */
export function documentToCSV(doc: AgentReconDocument): string {
  const bankCols = BANK_CHANNELS.map((b) => doc.bankDeposits[b] ?? 0);
  const headerRow = [
    "Currency",
    "Agent Name",
    "Opening Variance",
    "Insurance",
    "Premium Cover",
    "Commission",
    "Net Insurance",
    "Zinara",
    "Pds",
    "Total Expected",
    ...BANK_CHANNELS,
    "Alterations",
    "Closing Variance",
  ];
  const dataRow = [
    doc.currency,
    doc.agentName,
    String(doc.openingVariance),
    String(doc.insurance),
    String(doc.premiumCover),
    String(doc.commission),
    String(doc.netInsurance),
    String(doc.zinara),
    String(doc.pds),
    String(doc.totalExpected),
    ...bankCols.map(String),
    String(doc.adjustments),
    String(doc.closingVariance),
  ];

  const rows: string[][] = [
    ["QuickRecon Consolidated Revenue Report"],
    ["Agent", doc.agentName],
    ["Agent ID", doc.agentId],
    ["Module", doc.module],
    ["Period", doc.period],
    ["Generated", doc.generatedAt],
    [],
    headerRow.map(String),
    dataRow.map(String),
    [],
    ["Transaction Detail"],
    ["Date", "Agent", "Amount", "USD Amount", "USD-ZWG Conversion", "Bank/Account", "Narration/Ref", "Reference"],
    ...doc.transactions.map((t) => [
      t.date ?? "",
      t.agentName,
      String(t.amount),
      t.usdAmount != null ? String(t.usdAmount) : "",
      t.usdConversionRate != null ? String(t.usdConversionRate) : "",
      t.bankAccount ?? "",
      t.narration ?? "",
      t.reference,
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * Produces a plain-text summary suitable for SMS/WhatsApp or email body.
 */
export function documentToSMS(doc: AgentReconDocument): string {
  return `QuickRecon ${doc.period} reconciliation for ${doc.agentName} (${doc.agentId}): ${doc.summaryText} Closing variance: ${formatMoney(doc.closingVariance, doc.currency)}.`;
}

/**
 * Produces a simple HTML body for email distribution matching the real
 * Enpassent consolidated revenue report layout.
 */
export function documentToHTML(doc: AgentReconDocument): string {
  const bankHeaderCells = BANK_CHANNELS.map(
    (b) => `<th style="text-align:right;padding:6px;border:1px solid #ddd;">${b}</th>`
  ).join("");
  const bankDataCells = BANK_CHANNELS.map(
    (b) => `<td style="text-align:right;padding:6px;border:1px solid #ddd;">${(doc.bankDeposits[b] ?? 0).toLocaleString()}</td>`
  ).join("");
  const txnRows = doc.transactions
    .map(
      (t) => `<tr>
        <td style="padding:6px;border:1px solid #ddd;">${t.date ?? ""}</td>
        <td style="padding:6px;border:1px solid #ddd;">${t.agentName}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${t.amount.toLocaleString()}</td>
        <td style="text-align:right;padding:6px;border:1px solid #ddd;">${t.usdAmount != null ? t.usdAmount.toLocaleString() : ""}</td>
        <td style="padding:6px;border:1px solid #ddd;">${t.bankAccount ?? ""}</td>
        <td style="padding:6px;border:1px solid #ddd;">${t.narration ?? ""}</td>
      </tr>`
    )
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
      <h2>Consolidated Revenue Report — ${doc.period}</h2>
      <p><strong>Agent:</strong> ${doc.agentName} (${doc.agentId}) &nbsp; <strong>Currency:</strong> ${doc.currency}</p>
      <p>${doc.summaryText}</p>
      <table style="border-collapse:collapse;width:100%;max-width:900px;margin-top:12px;">
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:6px;border:1px solid #ddd;">Opening Variance</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Insurance</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Premium Cover</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Commission</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Net Insurance</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Zinara</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Total Expected</th>
          ${bankHeaderCells}
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Alterations</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Closing Variance</th>
        </tr>
        <tr>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.openingVariance.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.insurance.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.premiumCover.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.commission.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.netInsurance.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.zinara.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.totalExpected.toLocaleString()}</td>
          ${bankDataCells}
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.adjustments.toLocaleString()}</td>
          <td style="text-align:right;padding:6px;border:1px solid #ddd;">${doc.closingVariance.toLocaleString()}</td>
        </tr>
      </table>
      ${doc.transactions.length > 0 ? `<h3 style="margin-top:20px;">Transaction Detail</h3>
      <table style="border-collapse:collapse;width:100%;max-width:900px;">
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:6px;border:1px solid #ddd;">Date</th>
          <th style="text-align:left;padding:6px;border:1px solid #ddd;">Agent</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">Amount</th>
          <th style="text-align:right;padding:6px;border:1px solid #ddd;">USD</th>
          <th style="text-align:left;padding:6px;border:1px solid #ddd;">Bank/Account</th>
          <th style="text-align:left;padding:6px;border:1px solid #ddd;">Narration</th>
        </tr>
        ${txnRows}
      </table>` : ""}
      <p style="margin-top:16px;">This document is confidential and intended for ${doc.agentName} only.</p>
    </div>
  `;
}
