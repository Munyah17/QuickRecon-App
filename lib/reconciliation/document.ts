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
 * Serialises one agent document to CSV matching the real Enpassent
 * "Consolidated A" report — exactly 2 rows: header + figures, bank columns
 * before Alterations/Closing Variance. Private to that agent.
 */
export function documentToCSV(doc: AgentReconDocument): string {
  const bankCols = BANK_CHANNELS.map((b) => doc.bankDeposits[b] ?? "");
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
    doc.pds === 0 ? "" : String(doc.pds),
    String(doc.totalExpected),
    ...bankCols.map(String),
    doc.adjustments === 0 ? "" : String(doc.adjustments),
    String(doc.closingVariance),
  ];
  return [headerRow, dataRow]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/**
 * Produces the client-specified XLSX workbook via ExcelJS.
 * Worksheet 1 "Summary" — styled dashboard: navy title band, agent info,
 * colour-coded KPI cards, deposit-channel bar chart drawn with cell fills,
 * and a status banner. Worksheet 2 "Consolidated A" — the real 2-row
 * report plus transaction detail, matching the delivered sample layout.
 */
export async function documentToXLSX(doc: AgentReconDocument): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.default.Workbook();
  wb.creator = "QuickRecon App";
  wb.created = new Date();

  const NAVY = "FF0F2B4C";
  const BLUE = "FF1D4ED8";
  const LBLUE = "FFEFF6FF";
  const GREEN = "FF16A34A";
  const GREEN_BG = "FFF0FDF4";
  const AMBER = "FFD97706";
  const AMBER_BG = "FFFFFBEB";
  const RED = "FFDC2626";
  const RED_BG = "FFFEF2F2";
  const GREY = "FF6B7280";
  const BORDER = "FFE5E7EB";

  const thin = { style: "thin" as const, color: { argb: BORDER } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  const statusColor = doc.status === "success" ? GREEN : doc.status === "warning" ? AMBER : RED;
  const statusBg = doc.status === "success" ? GREEN_BG : doc.status === "warning" ? AMBER_BG : RED_BG;
  const statusLabel =
    doc.status === "success" ? "RECONCILED" : doc.status === "warning" ? "VARIANCE — REVIEW" : "ATTENTION REQUIRED";

  // ------------------------------------------------------------------
  // Sheet 1 — Summary dashboard
  // ------------------------------------------------------------------
  const ws = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 3 }, { width: 26 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 },
  ];

  // Title band
  ws.mergeCells("B2:G2");
  const title = ws.getCell("B2");
  title.value = "QUICKRECON — CONSOLIDATED REVENUE REPORT";
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 34;
  for (const c of ["B", "C", "D", "E", "F", "G"]) {
    ws.getCell(`${c}2`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  }

  ws.mergeCells("B3:G3");
  const sub = ws.getCell("B3");
  sub.value = `${doc.agentName} (${doc.agentId})  ·  ${doc.module}  ·  Period ${doc.period}  ·  ${doc.currency}`;
  sub.font = { size: 11, color: { argb: GREY } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(3).height = 22;

  // Status banner
  ws.mergeCells("B5:G5");
  const banner = ws.getCell("B5");
  banner.value = statusLabel;
  banner.font = { bold: true, size: 12, color: { argb: statusColor } };
  banner.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(5).height = 26;
  for (const c of ["B", "C", "D", "E", "F", "G"]) {
    ws.getCell(`${c}5`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusBg } };
    ws.getCell(`${c}5`).border = box;
  }

  // KPI cards — 3 per row, label over value
  const kpis: { label: string; value: number; color: string; bg: string }[] = [
    { label: "Insurance", value: doc.insurance, color: BLUE, bg: LBLUE },
    { label: "Commission", value: doc.commission, color: BLUE, bg: LBLUE },
    { label: "Net Insurance", value: doc.netInsurance, color: BLUE, bg: LBLUE },
    { label: "Zinara", value: doc.zinara, color: BLUE, bg: LBLUE },
    { label: "Total Expected", value: doc.totalExpected, color: NAVY, bg: "FFF1F5F9" },
    { label: "Total Deposits", value: doc.deposits, color: GREEN, bg: GREEN_BG },
    { label: "Alterations", value: doc.adjustments, color: GREY, bg: "FFF9FAFB" },
    {
      label: "Closing Variance",
      value: doc.closingVariance,
      color: doc.closingVariance === 0 ? GREEN : RED,
      bg: doc.closingVariance === 0 ? GREEN_BG : RED_BG,
    },
    { label: "Opening Variance", value: doc.openingVariance, color: GREY, bg: "FFF9FAFB" },
  ];

  let row = 7;
  for (let i = 0; i < kpis.length; i += 3) {
    const cards = kpis.slice(i, i + 3);
    // label row
    for (let j = 0; j < 3; j++) {
      const col = 2 + j * 2; // B, D, F
      const k = cards[j];
      if (!k) continue;
      ws.mergeCells(row, col, row, col + 1);
      const lc = ws.getCell(row, col);
      lc.value = k.label.toUpperCase();
      lc.font = { size: 9, bold: true, color: { argb: GREY } };
      lc.alignment = { horizontal: "center", vertical: "middle" };
      lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: k.bg } };
      ws.getCell(row, col).border = box;
      ws.getCell(row, col + 1).border = box;
      // value row
      ws.mergeCells(row + 1, col, row + 1, col + 1);
      const vc = ws.getCell(row + 1, col);
      vc.value = k.value;
      vc.numFmt = "#,##0.00";
      vc.font = { size: 15, bold: true, color: { argb: k.color } };
      vc.alignment = { horizontal: "center", vertical: "middle" };
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: k.bg } };
      ws.getCell(row + 1, col).border = box;
      ws.getCell(row + 1, col + 1).border = box;
    }
    ws.getRow(row).height = 18;
    ws.getRow(row + 1).height = 30;
    row += 3;
  }

  // Deposit channels — bar chart drawn with cell fills
  const channelEntries = BANK_CHANNELS
    .map((b) => ({ name: b, value: doc.bankDeposits[b] ?? 0 }))
    .filter((c) => c.value !== 0);
  if (channelEntries.length > 0) {
    row += 1;
    ws.mergeCells(row, 2, row, 7);
    const h = ws.getCell(row, 2);
    h.value = "DEPOSIT CHANNELS";
    h.font = { size: 10, bold: true, color: { argb: NAVY } };
    h.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(row).height = 20;
    row += 1;

    const max = Math.max(...channelEntries.map((c) => c.value), 1);
    for (const ch of channelEntries) {
      const name = ws.getCell(row, 2);
      name.value = ch.name;
      name.font = { size: 10, color: { argb: "FF374151" } };
      name.border = box;
      // bar spans C–G, filled proportional to share of max
      const span = Math.max(1, Math.round((ch.value / max) * 5));
      for (let c = 3; c <= 3 + span - 1; c++) {
        ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      }
      const val = ws.getCell(row, 7);
      val.value = ch.value;
      val.numFmt = "#,##0.00";
      val.font = { size: 10, bold: true, color: { argb: NAVY } };
      val.alignment = { horizontal: "right" };
      val.border = box;
      ws.getRow(row).height = 18;
      row += 1;
    }
  }

  // Footer note
  row += 2;
  ws.mergeCells(row, 2, row, 7);
  const note = ws.getCell(row, 2);
  note.value = `${doc.summaryText}  Generated ${doc.generatedAt} — confidential, intended for ${doc.agentName} only.`;
  note.font = { size: 9, italic: true, color: { argb: GREY } };
  note.alignment = { horizontal: "left", wrapText: true };
  ws.getRow(row).height = 28;

  // ------------------------------------------------------------------
  // Sheet 2 — Consolidated A (real 2-row format) + transaction detail
  // ------------------------------------------------------------------
  const ws2 = wb.addWorksheet("Consolidated A");
  const headerRow = [
    "Currency", "Agent Name", "Opening Variance", "Insurance", "Premium Cover",
    "Commission", "Net Insurance", "Zinara", "Pds", "Total Expected",
    ...BANK_CHANNELS, "Alterations", "Closing Variance",
  ];
  const bankVals = BANK_CHANNELS.map((b) => doc.bankDeposits[b] ?? "");
  const dataRow = [
    doc.currency, doc.agentName, doc.openingVariance, doc.insurance,
    doc.premiumCover, doc.commission, doc.netInsurance, doc.zinara,
    doc.pds === 0 ? "" : doc.pds, doc.totalExpected, ...bankVals,
    doc.adjustments === 0 ? "" : doc.adjustments, doc.closingVariance,
  ];
  ws2.addRow(headerRow);
  ws2.addRow(dataRow);
  ws2.getRow(1).eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.border = box;
  });
  ws2.getRow(2).eachCell((c) => {
    c.border = box;
    if (typeof c.value === "number") c.numFmt = "#,##0.00";
  });
  ws2.columns.forEach((c, i) => (c.width = i === 1 ? 24 : 14));

  // Transaction detail
  ws2.addRow([]);
  ws2.addRow(["Transaction Detail"]).getCell(1).font = { bold: true, size: 11, color: { argb: NAVY } };
  const txHeader = ["Date", "Agent", "Amount", "USD Amount", "USD-ZWG Conversion", "Bank/Account", "Narration/Ref", "Reference"];
  const txh = ws2.addRow(txHeader);
  txh.eachCell((c) => {
    c.font = { bold: true, size: 9, color: { argb: "FF374151" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    c.border = box;
  });
  for (const t of doc.transactions) {
    const r = ws2.addRow([
      t.date ?? "", t.agentName, t.amount,
      t.usdAmount ?? "", t.usdConversionRate ?? "",
      t.bankAccount ?? "", t.narration ?? "", t.reference,
    ]);
    r.eachCell((c) => (c.border = box));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
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
      <h2 style="margin-top:0;color:#0f2b4c;">Consolidated Revenue Report — ${doc.period}</h2>
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
