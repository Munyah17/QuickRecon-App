"use client";

import type { TableCell } from "pdfmake/interfaces";
import { formatMoney } from "@/lib/format";
import { getPdfMake } from "@/lib/export";
import type { Currency } from "@/types";

export interface Deduction {
  label: string;
  amount: number;
  /** Statutory deductions flagged for payslip wording. */
  statutory?: boolean;
}

export interface PayslipData {
  employeeId: string;
  employeeName: string;
  role?: string;
  department?: string;
  period: string;
  currency: Currency;
  basicSalary: number;
  allowances?: { label: string; amount: number }[];
  deductions?: Deduction[];
  loanRepayment?: { label: string; amount: number; balance?: number };
}

/**
 * Generates and downloads a real payroll payslip PDF for staff.
 * Supports statutory deductions (PAYE, NSSA, AIDS Levy), custom
 * deductions and loan repayments. Agents use commission statements
 * instead — see lib/erp/commission-statement.ts.
 */
export async function downloadPayslip(d: PayslipData) {
  const pdfMake = await getPdfMake();
  const allowances = d.allowances ?? [];
  const deductions = d.deductions ?? [];
  const gross = d.basicSalary + allowances.reduce((s, a) => s + a.amount, 0);
  const dedTotal = deductions.reduce((s, x) => s + x.amount, 0) + (d.loanRepayment?.amount ?? 0);
  const net = gross - dedTotal;

  const body: TableCell[][] = [
    [
      { text: "Earnings", style: "th" },
      { text: "Amount", style: "th", alignment: "right" },
    ],
    [{ text: "Basic salary", style: "td" }, { text: formatMoney(d.basicSalary, d.currency), style: "td", alignment: "right" }],
    ...allowances.map((a): TableCell[] => [
      { text: a.label, style: "td" },
      { text: formatMoney(a.amount, d.currency), style: "td", alignment: "right" },
    ]),
    [{ text: "GROSS PAY", style: "sub" }, { text: formatMoney(gross, d.currency), style: "sub", alignment: "right" }],
    [
      { text: "Deductions", style: "th" },
      { text: "", style: "th" },
    ],
    ...deductions.map((x): TableCell[] => [
      { text: x.label + (x.statutory ? " (statutory)" : ""), style: "td" },
      { text: `(${formatMoney(x.amount, d.currency)})`, style: "td", alignment: "right" },
    ]),
    ...(d.loanRepayment
      ? [[
          { text: `${d.loanRepayment.label} (loan repayment)`, style: "td" },
          { text: `(${formatMoney(d.loanRepayment.amount, d.currency)})`, style: "td", alignment: "right" as const },
        ] as TableCell[]]
      : []),
    [
      { text: "NET PAY", style: "totalLabel" },
      { text: formatMoney(net, d.currency), style: "totalLabel", alignment: "right" },
    ],
  ];

  pdfMake.createPdf({
    pageSize: "A4",
    pageMargins: [48, 48, 48, 56],
    footer: (page: number, pages: number) => ({
      text: `QuickRecon App — staff payslip · Page ${page} of ${pages}`,
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
              { text: "PAYSLIP", fontSize: 12, bold: true, alignment: "right", color: "#2563eb" },
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
              { text: "EMPLOYEE", fontSize: 8, color: "#6b7280", bold: true },
              { text: d.employeeName, fontSize: 12, bold: true, margin: [0, 2, 0, 0] },
              { text: d.employeeId, fontSize: 9, color: "#6b7280", margin: [0, 1, 0, 0] },
              ...(d.role ? [{ text: d.role, fontSize: 9, color: "#6b7280" }] : []),
            ],
          },
          {
            stack: [
              { text: "CURRENCY", fontSize: 8, color: "#6b7280", bold: true, alignment: "right" },
              { text: d.currency === "ZWG" ? "ZiG (Zimbabwe Gold)" : "USD", fontSize: 10, alignment: "right", margin: [0, 2, 0, 0] },
            ],
          },
        ],
      },
      {
        margin: [0, 18, 0, 0],
        table: { widths: ["*", "auto"], body },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: "#e5e7eb",
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      ...(d.loanRepayment?.balance !== undefined
        ? [{
            text: `Loan balance after this payment: ${formatMoney(d.loanRepayment.balance, d.currency)}`,
            fontSize: 8,
            color: "#6b7280",
            margin: [0, 10, 0, 0] as [number, number, number, number],
          }]
        : []),
      {
        text: "Statutory deductions (PAYE, NSSA, AIDS Levy) are remitted to the respective authorities. Queries: hr@quickrecon.co.zw",
        fontSize: 8,
        color: "#9ca3af",
        margin: [0, 24, 0, 0] as [number, number, number, number],
      },
    ],
    styles: {
      th: { fontSize: 9, bold: true, color: "#374151", fillColor: "#f3f4f6" },
      td: { fontSize: 10, color: "#111827" },
      sub: { fontSize: 10, bold: true, color: "#111827", fillColor: "#f9fafb" },
      totalLabel: { fontSize: 11, bold: true, color: "#0f2b4c", fillColor: "#eff6ff" },
    },
  }).download(`payslip-${d.employeeId}-${d.period.replace(/\s+/g, "-")}.pdf`);
}
