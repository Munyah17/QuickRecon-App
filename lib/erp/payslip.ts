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
  /** Zimbabwe template fields (all optional). */
  companyName?: string;
  companyAddress?: string;
  dateJoined?: string;
  daysWorked?: string | number;
  bankName?: string;
  bankAccount?: string;
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
  const money = (n: number) => formatMoney(n, d.currency);

  // Earnings / deductions zipped side-by-side like the Zim template.
  const earnRows: [string, string][] = [
    ["Basic Salary", money(d.basicSalary)],
    ...allowances.map((a): [string, string] => [a.label, money(a.amount)]),
  ];
  const dedRows: [string, string][] = [
    ...deductions.map((x): [string, string] => [x.label, money(x.amount)]),
    ...(d.loanRepayment
      ? [[`${d.loanRepayment.label} (loan)`, money(d.loanRepayment.amount)] as [string, string]]
      : []),
  ];
  const rowCount = Math.max(earnRows.length, dedRows.length);
  const body: TableCell[][] = [
    [
      { text: "Earnings", style: "th" },
      { text: "Amount", style: "th", alignment: "right" },
      { text: "Deductions", style: "th" },
      { text: "Amount", style: "th", alignment: "right" },
    ],
    ...Array.from({ length: rowCount }, (_, i): TableCell[] => [
      { text: earnRows[i]?.[0] ?? "", style: "td" },
      { text: earnRows[i]?.[1] ?? "", style: "td", alignment: "right" },
      { text: dedRows[i]?.[0] ?? "", style: "td" },
      { text: dedRows[i]?.[1] ?? "", style: "td", alignment: "right" },
    ]),
    [
      { text: "Total Earnings", style: "sub" },
      { text: money(gross), style: "sub", alignment: "right" },
      { text: "Total Deductions", style: "sub" },
      { text: money(dedTotal), style: "sub", alignment: "right" },
    ],
    [
      { text: "Net Pay (Rounded)", style: "totalLabel", colSpan: 3, alignment: "center" },
      {},
      {},
      { text: money(Math.round(net)), style: "totalLabel", alignment: "right" },
    ],
  ];

  const detail = (label: string, value?: string | number): TableCell[] => [
    { text: label, style: "dl" },
    { text: `: ${value ?? "—"}`, style: "dv" },
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
      { text: d.companyName ?? "QuickRecon App", fontSize: 16, bold: true, alignment: "center", color: "#111827" },
      { text: d.companyAddress ?? "Harare, Zimbabwe", fontSize: 9, alignment: "center", color: "#374151", margin: [0, 2, 0, 0] },
      { text: `Payslip for the period of ${d.period}`, fontSize: 11, bold: true, alignment: "center", margin: [0, 8, 0, 0] },
      {
        margin: [0, 16, 0, 0],
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [...detail("Employee Id", d.employeeId), ...detail("Name", d.employeeName)],
            [...detail("Department", d.department), ...detail("Designation", d.role)],
            [...detail("Date of Joining", d.dateJoined), ...detail("Days Worked", d.daysWorked)],
            [...detail("Bank Name, Branch", d.bankName), ...detail("Bank Acct/Cheque Number", d.bankAccount)],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: "#d1d5db",
          vLineColor: "#d1d5db",
          paddingTop: () => 5,
          paddingBottom: () => 5,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
      },
      {
        margin: [0, 14, 0, 0],
        table: { widths: ["*", "auto", "*", "auto"], body },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: "#d1d5db",
          vLineColor: "#d1d5db",
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
      },
      {
        text: `(All figures in ${d.currency === "ZWG" ? "ZiG" : "Dollar"})`,
        fontSize: 8,
        italics: true,
        alignment: "center",
        color: "#6b7280",
        margin: [0, 8, 0, 0],
      },
      ...(d.loanRepayment?.balance !== undefined
        ? [{
            text: `Loan balance after this payment: ${money(d.loanRepayment.balance)}`,
            fontSize: 8,
            color: "#6b7280",
            margin: [0, 8, 0, 0] as [number, number, number, number],
          }]
        : []),
      {
        margin: [0, 48, 0, 0],
        columns: [
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 160, y2: 0, lineColor: "#9ca3af", lineWidth: 0.75 }] },
              { text: "Employer's Signature", fontSize: 9, color: "#374151", margin: [0, 4, 0, 0] },
            ],
          },
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 160, y2: 0, lineColor: "#9ca3af", lineWidth: 0.75 }] },
              { text: "Employee's Signature", fontSize: 9, color: "#374151", margin: [0, 4, 0, 0] },
            ],
            alignment: "right",
          },
        ],
      },
      {
        text: "Statutory deductions (PAYE, NSSA, AIDS Levy) are remitted to the respective authorities. Queries: hr@quickrecon.co.zw",
        fontSize: 8,
        color: "#9ca3af",
        margin: [0, 28, 0, 0] as [number, number, number, number],
      },
    ],
    styles: {
      th: { fontSize: 9, bold: true, color: "#111827", fillColor: "#f3f4f6" },
      td: { fontSize: 10, color: "#111827" },
      dl: { fontSize: 9, color: "#374151" },
      dv: { fontSize: 9, bold: true, color: "#111827" },
      sub: { fontSize: 10, bold: true, color: "#111827", fillColor: "#f9fafb" },
      totalLabel: { fontSize: 11, bold: true, color: "#111827", fillColor: "#e5e7eb" },
    },
  }).download(`payslip-${d.employeeId}-${d.period.replace(/\s+/g, "-")}.pdf`);
}
