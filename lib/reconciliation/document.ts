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
  /** Split PDS for the workbook Summary sheet (default: pds â†’ insurancePds). */
  insurancePds?: number;
  zinaraPds?: number;
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
 * No agent sees another agent's figures â€” documents are isolated by agentId.
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

/** Neutralise CSV formula injection â€” cells starting with =, +, @ or tab
 * are flagged by mail scanners and dangerous when opened in Excel. */
function csvSafe(value: unknown): string {
  const s = String(value ?? "");
  return /^[=+@\t]/.test(s) ? `'${s}` : s;
}

/**
 * Serialises one agent document to CSV matching the real Enpassent
 * "Consolidated A" report â€” exactly 2 rows: header + figures, bank columns
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
    .map((r) => r.map((c) => `"${csvSafe(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Canonical summary-sheet column order from the client's real workbook. */
const SUMMARY_BANK_COLS = ["Ecocash", "CBZ", "NBS", "STEWARD", "USD Deposits", "Transfers"] as const;

interface DetailSheet {
  name: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Produces the client's real multi-sheet reconciliation workbook:
 *   Dashboard  â€” USD | ZiG split dashboard (stat cards, bars, status banner)
 *   Summary    â€” every column, 2 rows (USD + ZiG), zero-filled
 *   Insurance  â€” insurance sales (VRN, premium, RTA, insurer)
 *   ZINARA     â€” zinara sales (account ID, VRN, payment method)
 *   <Bank>     â€” one sheet per bank actually used (CBZ, NBS, NMB, STEWARDâ€¦)
 *   USD Deposits / ZiG Deposits
 *   Transfers & Ecocash
 *   Alterations
 * `docs` is the agent's document set â€” one per currency. Missing currency
 * rows are zero-filled so the workbook never fails.
 */
export async function documentsToWorkbook(docs: AgentReconDocument[]): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.default.Workbook();
  wb.creator = "QuickRecon App";
  wb.created = new Date();

  const usd = docs.find((d) => d.currency === "USD") ?? null;
  const zig = docs.find((d) => d.currency === "ZWG") ?? null;
  const primary = usd ?? zig;
  if (!primary) throw new Error("No documents to render");

  const NAVY = "FF0F2B4C", BLUE = "FF1D4ED8", LBLUE = "FFEFF6FF",
    GREEN = "FF16A34A", GREEN_BG = "FFF0FDF4", AMBER = "FFD97706",
    AMBER_BG = "FFFFFBEB", RED = "FFDC2626", RED_BG = "FFFEF2F2",
    GREY = "FF6B7280", BORDER = "FFE5E7EB";
  const thin = { style: "thin" as const, color: { argb: BORDER } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

  const statusOf = (d: AgentReconDocument | null) =>
    !d || d.status === "success" ? GREEN : d.status === "warning" ? AMBER : RED;
  const statusBgOf = (d: AgentReconDocument | null) =>
    !d || d.status === "success" ? GREEN_BG : d.status === "warning" ? AMBER_BG : RED_BG;
  const labelOf = (d: AgentReconDocument | null) =>
    !d ? "NO DATA" : d.status === "success" ? "RECONCILED" : d.status === "warning" ? "VARIANCE â€” REVIEW" : "ATTENTION REQUIRED";

  // â”€â”€ Sheet 1: Dashboard â€” USD left, ZiG right â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ws = wb.addWorksheet("Dashboard", { views: [{ showGridLines: false }] });
  ws.columns = [
    { width: 3 },
    { width: 24 }, { width: 15 }, { width: 15 }, { width: 15 },   // USD side  Bâ€“E
    { width: 3 },                                                  // centre divider F
    { width: 24 }, { width: 15 }, { width: 15 }, { width: 15 },   // ZiG side  Gâ€“J
    { width: 3 },
  ];

  ws.mergeCells("B2:J2");
  const title = ws.getCell("B2");
  title.value = "QUICKRECON â€” CONSOLIDATED REVENUE REPORT";
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 34;
  for (let c = 2; c <= 10; c++) ws.getCell(2, c).fill = fill(NAVY);

  ws.mergeCells("B3:J3");
  const sub = ws.getCell("B3");
  sub.value = `${primary.agentName} (${primary.agentId})  Â·  ${primary.module}  Â·  Period ${primary.period}`;
  sub.font = { size: 11, color: { argb: GREY } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(3).height = 20;

  // Centre divider
  for (let r = 5; r <= 40; r++) {
    ws.getCell(r, 6).fill = fill("FFD1D5DB");
  }

  const paintSide = (doc: AgentReconDocument | null, leftCol: number, currency: "USD" | "ZiG") => {
    // currency heading
    ws.mergeCells(5, leftCol, 5, leftCol + 3);
    const h = ws.getCell(5, leftCol);
    h.value = currency;
    h.font = { bold: true, size: 20, color: { argb: NAVY } };
    h.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(5).height = 30;

    // status banner
    ws.mergeCells(6, leftCol, 6, leftCol + 3);
    const b = ws.getCell(6, leftCol);
    b.value = labelOf(doc);
    b.font = { bold: true, size: 11, color: { argb: statusOf(doc) } };
    b.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(6).height = 24;
    for (let c = leftCol; c <= leftCol + 3; c++) {
      ws.getCell(6, c).fill = fill(statusBgOf(doc));
      ws.getCell(6, c).border = box;
    }

    // KPI cards â€” stacked label/value pairs, one column pair each
    const kpis: [string, number, string, string][] = doc ? [
      ["Insurance", doc.insurance, BLUE, LBLUE],
      ["Commission", doc.commission, BLUE, LBLUE],
      ["Net Insurance", doc.netInsurance, BLUE, LBLUE],
      ["ZINARA", doc.zinara, BLUE, LBLUE],
      ["Total Expected", doc.totalExpected, NAVY, "FFF1F5F9"],
      ["Total Deposits", doc.deposits, GREEN, GREEN_BG],
      ["Alterations", doc.adjustments, GREY, "FFF9FAFB"],
      ["Closing Variance", doc.closingVariance, doc.closingVariance === 0 ? GREEN : RED, doc.closingVariance === 0 ? GREEN_BG : RED_BG],
      ["Opening Variance", doc.openingVariance, GREY, "FFF9FAFB"],
    ] : [
      ["Insurance", 0, GREY, "FFF9FAFB"], ["Commission", 0, GREY, "FFF9FAFB"],
      ["Net Insurance", 0, GREY, "FFF9FAFB"], ["ZINARA", 0, GREY, "FFF9FAFB"],
      ["Total Expected", 0, GREY, "FFF9FAFB"], ["Total Deposits", 0, GREY, "FFF9FAFB"],
      ["Alterations", 0, GREY, "FFF9FAFB"], ["Closing Variance", 0, GREY, "FFF9FAFB"],
      ["Opening Variance", 0, GREY, "FFF9FAFB"],
    ];

    let row = 8;
    for (let i = 0; i < kpis.length; i += 2) {
      const pair = kpis.slice(i, i + 2);
      for (let j = 0; j < 2; j++) {
        const col = leftCol + j * 2;
        const k = pair[j];
        if (!k) continue;
        ws.mergeCells(row, col, row, col + 1);
        const lc = ws.getCell(row, col);
        lc.value = k[0].toUpperCase();
        lc.font = { size: 9, bold: true, color: { argb: GREY } };
        lc.alignment = { horizontal: "center", vertical: "middle" };
        lc.fill = fill(k[3]);
        lc.border = box;
        ws.getCell(row, col + 1).border = box;
        ws.mergeCells(row + 1, col, row + 1, col + 1);
        const vc = ws.getCell(row + 1, col);
        vc.value = k[1];
        vc.numFmt = "#,##0.00";
        vc.font = { size: 14, bold: true, color: { argb: k[2] } };
        vc.alignment = { horizontal: "center", vertical: "middle" };
        vc.fill = fill(k[3]);
        vc.border = box;
        ws.getCell(row + 1, col + 1).border = box;
      }
      ws.getRow(row).height = 17;
      ws.getRow(row + 1).height = 28;
      row += 3;
    }

    // Deposit channel bars
    const chans = doc
      ? Object.entries(doc.bankDeposits).filter(([, v]) => v !== 0)
      : [];
    if (chans.length) {
      row += 1;
      ws.mergeCells(row, leftCol, row, leftCol + 3);
      const ch = ws.getCell(row, leftCol);
      ch.value = "DEPOSIT CHANNELS";
      ch.font = { size: 10, bold: true, color: { argb: NAVY } };
      ws.getRow(row).height = 18;
      row += 1;
      const max = Math.max(...chans.map(([, v]) => v), 1);
      for (const [name, value] of chans) {
        const nc = ws.getCell(row, leftCol);
        nc.value = name;
        nc.font = { size: 10, color: { argb: "FF374151" } };
        nc.border = box;
        const span = Math.max(1, Math.round((value / max) * 2));
        for (let c = leftCol + 1; c < leftCol + 1 + span; c++) {
          ws.getCell(row, c).fill = fill(BLUE);
        }
        const vc = ws.getCell(row, leftCol + 3);
        vc.value = value;
        vc.numFmt = "#,##0.00";
        vc.font = { size: 10, bold: true, color: { argb: NAVY } };
        vc.alignment = { horizontal: "right" };
        vc.border = box;
        ws.getRow(row).height = 17;
        row += 1;
      }
    }
  };

  paintSide(usd, 2, "USD");
  paintSide(zig, 7, "ZiG");

  // â”€â”€ Sheet 2: Summary â€” all columns, USD + ZiG rows, zero-filled â”€â”€â”€â”€â”€
  const wsS = wb.addWorksheet("Summary");
  const allBanks = new Set<string>();
  for (const d of [usd, zig]) {
    if (d) Object.keys(d.bankDeposits).forEach((b) => allBanks.add(b));
  }
  const bankCols = [
    ...SUMMARY_BANK_COLS,
    ...[...allBanks].filter((b) => !SUMMARY_BANK_COLS.includes(b as (typeof SUMMARY_BANK_COLS)[number])),
  ];
  const sHeader = [
    "Currency", "Agent Name", "Opening Variance", "Insurance", "Premium Cover",
    "Commission", "Net Insurance", "ZINARA", "Insurance PDS", "ZINARA PDS",
    "Total Expected", ...bankCols, "Alterations", "Closing Variance",
  ];
  wsS.addRow(sHeader);
  const sRow = (d: AgentReconDocument | null, cur: "USD" | "ZiG") => [
    cur, d?.agentName ?? primary.agentName, d?.openingVariance ?? 0,
    d?.insurance ?? 0, d?.premiumCover ?? 0, d?.commission ?? 0,
    d?.netInsurance ?? 0, d?.zinara ?? 0, d?.insurancePds ?? d?.pds ?? 0,
    d?.zinaraPds ?? 0, d?.totalExpected ?? 0,
    ...bankCols.map((b) => d?.bankDeposits[b] ?? 0),
    d?.adjustments ?? 0, d?.closingVariance ?? 0,
  ];
  wsS.addRow(sRow(usd, "USD"));
  wsS.addRow(sRow(zig, "ZiG"));
  wsS.getRow(1).eachCell((c) => {
    c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    c.fill = fill(NAVY);
    c.border = box;
    c.alignment = { vertical: "middle", wrapText: true };
  });
  wsS.getRow(1).height = 28;
  for (const r of [2, 3]) {
    wsS.getRow(r).eachCell((c) => {
      c.border = box;
      if (typeof c.value === "number") c.numFmt = "#,##0.00";
    });
    wsS.getRow(r).height = 20;
  }
  wsS.columns.forEach((c, i) => (c.width = i === 1 ? 24 : i === 0 ? 9 : 13));

  // â”€â”€ Detail sheets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const txns = [...(usd?.transactions ?? []), ...(zig?.transactions ?? [])];
  const bankNames = new Set<string>();
  for (const t of txns) if (t.bankAccount) bankNames.add(t.bankAccount);

  const detailSheets: DetailSheet[] = [
    {
      name: "Insurance",
      columns: ["VRN", "Agent", "Date", "Premium Collected", "RTA Amount", "Currency", "Insurance Company"],
      rows: txns
        .filter((t) => t.category === "insurance")
        .map((t) => [t.vrn ?? "", t.agentName, t.date ?? "", t.amount, t.rtaAmount ?? 0, t.currency ?? "", t.insuranceCompany ?? ""]),
    },
    {
      name: "ZINARA",
      columns: ["Agent Name", "ZINARA Account ID", "VRN", "Payment Method", "Amount Paid", "Currency"],
      rows: txns
        .filter((t) => t.category === "zinara")
        .map((t) => [t.agentName, t.zinaraAccountId ?? "", t.vrn ?? "", t.paymentMethod ?? "", t.amount, t.currency ?? ""]),
    },
    ...[...bankNames].sort().map((bank): DetailSheet => ({
      name: bank,
      columns: ["Name", "Agent", "Amount", "Currency", "Posting Date", "Bank", "Insurance Company"],
      rows: txns
        .filter((t) => t.bankAccount === bank)
        .map((t) => [t.narration ?? t.reference, t.agentName, t.amount, t.currency ?? "", t.date ?? "", bank, t.insuranceCompany ?? ""]),
    })),
    {
      name: "USD Deposits",
      columns: ["Agent", "Amount", "Currency", "Date"],
      rows: txns
        .filter((t) => t.category === "deposit" && (t.currency === "USD" || t.bankAccount === "USD"))
        .map((t) => [t.agentName, t.amount, t.currency ?? "USD", t.date ?? ""]),
    },
    {
      name: "ZiG Deposits",
      columns: ["Agent", "Amount", "Currency", "Date"],
      rows: txns
        .filter((t) => t.category === "deposit" && (t.currency ?? "ZWG") === "ZWG" && t.bankAccount !== "USD")
        .map((t) => [t.agentName, t.amount, t.currency ?? "ZWG", t.date ?? ""]),
    },
    {
      name: "Transfers & Ecocash",
      columns: ["Agent", "Amount", "Currency", "Channel", "Reference", "Date"],
      rows: txns
        .filter((t) => t.bankAccount === "Ecocash" || t.bankAccount === "Transfers")
        .map((t) => [t.agentName, t.amount, t.currency ?? "", t.bankAccount ?? "", t.reference, t.date ?? ""]),
    },
    {
      name: "Alterations",
      columns: ["Agent", "Amount", "Currency", "Reference", "Narration", "Date"],
      rows: txns
        .filter((t) => t.category === "adjustment")
        .map((t) => [t.agentName, t.amount, t.currency ?? "", t.reference, t.narration ?? "", t.date ?? ""]),
    },
  ];

  for (const s of detailSheets) {
    const w = wb.addWorksheet(s.name);
    w.addRow(s.columns);
    for (const r of s.rows) w.addRow(r);
    w.getRow(1).eachCell((c) => {
      c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      c.fill = fill(NAVY);
      c.border = box;
    });
    w.getRow(1).height = 22;
    for (let r = 2; r <= w.rowCount; r++) {
      w.getRow(r).eachCell((c) => {
        c.border = box;
        if (typeof c.value === "number") c.numFmt = "#,##0.00";
      });
    }
    w.columns.forEach((c) => (c.width = 18));
    if (s.columns.length > 2) w.getColumn(1).width = 24;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Back-compat: single-currency call still works. */
export async function documentToXLSX(doc: AgentReconDocument): Promise<Buffer> {
  return documentsToWorkbook([doc]);
}

/** Recursively locate the vfs font dictionary (keys end in .ttf) inside
 * whatever interop shape the bundler gives vfs_fonts. */
function findVfs(obj: unknown, depth = 0): Record<string, string> | null {
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  const rec = obj as Record<string, unknown>;
  if (Object.keys(rec).some((k) => k.endsWith(".ttf"))) {
    return rec as Record<string, string>;
  }
  for (const v of Object.values(rec)) {
    const found = findVfs(v, depth + 1);
    if (found) return found;
  }
  return null;
}

interface PdfMakeLike {
  vfs: Record<string, string>;
  createPdf: (def: unknown) => { getBuffer: (cb: (b: Uint8Array) => void) => void };
}

/**
 * Server-side PDF of the consolidated revenue report — one section per
 * currency document (USD + ZiG), matching the workbook Summary layout.
 * Used for email attachments.
 */
export async function documentsToPDF(docs: AgentReconDocument[]): Promise<Buffer> {
  if (docs.length === 0) throw new Error("No documents to render");
  const [pdfMakeMod, fontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = ((pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod) as PdfMakeLike;
  const vfs = findVfs(fontsMod);
  if (!vfs) throw new Error("pdfmake fonts failed to load (empty vfs)");
  pdfMake.vfs = vfs;

  const primary = docs[0];
  const statusLabel = (d: AgentReconDocument) =>
    d.status === "success" ? "RECONCILED" : d.status === "warning" ? "VARIANCE — REVIEW" : "ATTENTION REQUIRED";
  const statusColor = (d: AgentReconDocument) =>
    d.status === "success" ? "#16a34a" : d.status === "warning" ? "#d97706" : "#dc2626";

  const content: object[] = [
    {
      columns: [
        {
          stack: [
            { text: "QuickRecon App", fontSize: 16, bold: true, color: "#0f2b4c" },
            { text: "Agents. Reconciliation. Growth.", fontSize: 8, color: "#6b7280" },
          ],
        },
        {
          stack: [
            { text: "CONSOLIDATED REVENUE REPORT", fontSize: 11, bold: true, alignment: "right", color: "#2563eb" },
            { text: `${primary.module} · Period ${primary.period}`, fontSize: 8, alignment: "right", color: "#6b7280", margin: [0, 2, 0, 0] },
          ],
        },
      ],
    },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 770, y2: 0, lineColor: "#2563eb", lineWidth: 2 }], margin: [0, 10, 0, 10] },
    { text: `Agent: ${primary.agentName} (${primary.agentId})`, fontSize: 10, bold: true, margin: [0, 0, 0, 8] },
  ];

  docs.forEach((doc, i) => {
    const bankCols = Object.keys(doc.bankDeposits);
    const header = [
      "Opening Var", "Insurance", "Premium Cover", "Commission", "Net Insurance",
      "ZINARA", "PDS", "Total Expected", ...bankCols, "Alterations", "Closing Var",
    ];
    const values = [
      doc.openingVariance, doc.insurance, doc.premiumCover, doc.commission,
      doc.netInsurance, doc.zinara, doc.pds, doc.totalExpected,
      ...bankCols.map((b) => doc.bankDeposits[b]),
      doc.adjustments, doc.closingVariance,
    ].map((v) => (v === 0 ? "" : v.toLocaleString("en-ZW", { minimumFractionDigits: 2 })));

    content.push(
      {
        columns: [
          { text: doc.currency === "USD" ? "USD" : "ZiG", fontSize: 13, bold: true, color: "#0f2b4c" },
          { text: statusLabel(doc), fontSize: 9, bold: true, color: statusColor(doc), alignment: "right" },
        ],
        margin: [0, i === 0 ? 0 : 14, 0, 4],
      },
      {
        table: {
          headerRows: 1,
          widths: header.map(() => "auto"),
          body: [
            header.map((h) => ({ text: h, fontSize: 6.5, bold: true, color: "#ffffff", fillColor: "#0f2b4c" })),
            values.map((v) => ({ text: v, fontSize: 7, alignment: "right", color: "#111827" })),
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: "#e5e7eb", vLineColor: "#e5e7eb" },
      },
      { text: doc.summaryText, fontSize: 8, color: "#6b7280", margin: [0, 4, 0, 0] },
    );

    if (doc.transactions.length > 0) {
      content.push(
        { text: "Transaction Detail", fontSize: 9, bold: true, color: "#0f2b4c", margin: [0, 10, 0, 3] },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto", "auto", "*"],
            body: [
              ["Date", "Agent", "Amount", "USD", "Bank/Account", "Narration"].map((h) => ({
                text: h, fontSize: 7, bold: true, color: "#374151", fillColor: "#f3f4f6",
              })),
              ...doc.transactions.map((t) => [
                { text: t.date ?? "", fontSize: 7 },
                { text: t.agentName, fontSize: 7 },
                { text: t.amount.toLocaleString(), fontSize: 7, alignment: "right" as const },
                { text: t.usdAmount != null ? t.usdAmount.toLocaleString() : "", fontSize: 7, alignment: "right" as const },
                { text: t.bankAccount ?? "", fontSize: 7 },
                { text: t.narration ?? "", fontSize: 7 },
              ]),
            ],
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: "#e5e7eb" },
        },
      );
    }
  });

  content.push({
    text: `Confidential — intended for ${primary.agentName} only. Generated ${new Date().toLocaleString("en-ZW")}.`,
    fontSize: 7,
    color: "#9ca3af",
    margin: [0, 16, 0, 0],
  });

  const docDef = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 36, 28, 40],
    footer: (page: number, pages: number) => ({
      text: `QuickRecon App — consolidated revenue report · Page ${page} of ${pages}`,
      alignment: "center",
      fontSize: 7,
      color: "#6b7280",
      margin: [0, 10, 0, 0],
    }),
    content,
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBuffer((buf: Uint8Array) => resolve(Buffer.from(buf)));
    } catch (e) {
      reject(e);
    }
  });
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
      <h2 style="margin-top:0;color:#0f2b4c;">Consolidated Revenue Report â€” ${doc.period}</h2>
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
