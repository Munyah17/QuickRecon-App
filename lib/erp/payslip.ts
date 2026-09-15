"use client";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { TableCell } from "pdfmake/interfaces";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/types";

// vfs_fonts shape differs between pdfmake builds — handle both.
const fonts = pdfFonts as unknown as { vfs?: Record<string, string>; pdfMake?: { vfs: Record<string, string> } };
(pdfMake as unknown as { vfs: Record<string, string> }).vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? {};

export interface PayslipData {
  agentId: string;
  agentName: string;
  province?: string;
  period: string;
  currency: Currency;
  commission: number;
  bonus: number;
  adjustments?: { label: string; amount: number }[];
}

/**
 * Generates and downloads a commission/bonus payslip PDF.
 * Agents are not employees — this is a payout statement, not a salary slip.
 */
export function downloadPayslip(d: PayslipData) {
  const adjustments = d.adjustments ?? [];
  const adjTotal = adjustments.reduce((s, a) => s + a.amount, 0);
  const gross = d.commission + d.bonus + adjTotal;

  pdfMake.createPdf({
    pageSize: "A4",
    pageMargins: [48, 48, 48, 56],
    footer: (page: number, pages: number) => ({
      text: `QuickRecon App — agent payout statement · Page ${page} of ${pages}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
      margin: [0, 12, 0, 0],
    }),
    content: [
      {
        columns: [
          {
            stack: [
              { text: "QuickRecon App", fontSize: 18, bold: true, color: "#0f2b4c" },
              { text: "Agents. Reconciliation. Growth.", fontSize: 9, color: "#6b7280" },
            ],
          },
          {
            stack: [
              { text: "COMMISSION PAYOUT STATEMENT", fontSize: 12, bold: true, alignment: "right", color: "#2563eb" },
              { text: `Period: ${d.period}`, fontSize: 9, alignment: "right", color: "#6b7280", margin: [0, 2, 0, 0] },
            ],
          },
        ],
        columnGap: 16,
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineColor: "#2563eb", lineWidth: 2 }], margin: [0, 14, 0, 14] },
      {
        columns: [
          {
            stack: [
              { text: "AGENT", fontSize: 8, color: "#6b7280", bold: true },
              { text: d.agentName, fontSize: 12, bold: true, margin: [0, 2, 0, 0] },
              { text: d.agentId, fontSize: 9, color: "#6b7280", margin: [0, 1, 0, 0] },
              ...(d.province ? [{ text: d.province, fontSize: 9, color: "#6b7280" }] : []),
            ],
          },
          {
            stack: [
              { text: "PAYOUT CURRENCY", fontSize: 8, color: "#6b7280", bold: true, alignment: "right" },
              { text: d.currency === "ZWG" ? "ZiG (Zimbabwe Gold)" : "USD", fontSize: 10, alignment: "right", margin: [0, 2, 0, 0] },
            ],
          },
        ],
      },
      {
        margin: [0, 18, 0, 0],
        table: {
          widths: ["*", "auto"],
          body: ([
            [
              { text: "Item", style: "th" },
              { text: "Amount", style: "th", alignment: "right" as const },
            ],
            [{ text: "Commission (insurance & module sales)", style: "td" }, { text: formatMoney(d.commission, d.currency), style: "td", alignment: "right" as const }],
            [{ text: "Performance bonus", style: "td" }, { text: formatMoney(d.bonus, d.currency), style: "td", alignment: "right" as const }],
            ...adjustments.map((a) => [
              { text: a.label, style: "td" },
              { text: formatMoney(a.amount, d.currency), style: "td", alignment: "right" as const },
            ]),
            [
              { text: "TOTAL PAYOUT", style: "totalLabel" },
              { text: formatMoney(gross, d.currency), style: "totalLabel", alignment: "right" as const },
            ],
          ]) as TableCell[][],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: "#e5e7eb",
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      {
        text: "Agents are independent contractors — this statement reflects commissions and bonuses for the period, not a salary. Queries: support@quickrecon.co.zw",
        fontSize: 8,
        color: "#9ca3af",
        margin: [0, 24, 0, 0],
      },
    ],
    styles: {
      th: { fontSize: 9, bold: true, color: "#374151", fillColor: "#f3f4f6" },
      td: { fontSize: 10, color: "#111827" },
      totalLabel: { fontSize: 11, bold: true, color: "#0f2b4c", fillColor: "#eff6ff" },
    },
  }).download(`payslip-${d.agentId}-${d.period}.pdf`);
}
