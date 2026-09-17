"use client";

import { getPdfMake } from "@/lib/export";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Currency } from "@/types";

export interface DocLine {
  code?: string;          // SKU / item code
  description: string;
  qty: number;
  unit?: string;          // e.g. "hrs", "pcs", "svc"
  unitPrice: number;
  discountPct?: number;   // per-line discount, 0–100
}

export type DocStatus =
  | "paid"
  | "pending"
  | "overdue"
  | "draft"
  | "accepted"
  | "declined";

export interface BusinessDoc {
  kind: "invoice" | "quotation";
  number: string;
  status?: DocStatus;
  client: string;
  clientContact?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientVat?: string;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  poNumber?: string;
  reference?: string;
  currency: Currency;
  lines: DocLine[];
  discountPct?: number;   // document-level discount, 0–100
  shipping?: number;
  vatRate?: number;
  amountPaid?: number;
  notes?: string;
  terms?: string[];
  preparedBy?: string;
}

const SYM: Record<Currency, string> = { USD: "USD", ZWG: "ZiG" };

const COMPANY = {
  name: "Enpassent (Private) Limited",
  tagline: "Insurance · Reconciliation · Agent Network",
  address: "Harare, Zimbabwe",
  phone: "+263 77 000 0000",
  email: "accounts@enpassent.co.zw",
  web: "www.enpassent.co.zw",
  vatNo: "VAT No. 10023456",
  tin: "TIN 2001234567",
  bank: {
    bank: "CBZ Bank",
    accountName: "Enpassent (Pvt) Ltd",
    accountNo: "011 2345 6789 01",
    branch: "Borrowdale, Harare",
    ecocash: "EcoCash Merchant 0771 234 567",
  },
};

const STATUS_COLOR: Record<DocStatus, string> = {
  paid: "#15803d",
  accepted: "#15803d",
  pending: "#b45309",
  overdue: "#b91c1c",
  declined: "#b91c1c",
  draft: "#6b7280",
};

/* ── amount in words ── */
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function toWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const scales: [number, string][] = [
    [1_000_000_000, "Billion"],
    [1_000_000, "Million"],
    [1_000, "Thousand"],
  ];
  for (const [value, name] of scales) {
    if (n >= value) {
      parts.push(`${toWords(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n > 0) parts.push(threeDigits(n));
  return parts.join(" ");
}

function amountInWords(total: number, sym: string): string {
  const whole = Math.floor(total);
  const cents = Math.round((total - whole) * 100);
  const unit = sym === "ZiG" ? "ZiG" : "Dollars";
  const cent = sym === "ZiG" ? "cents" : "cents";
  return cents > 0
    ? `${toWords(whole)} ${unit} and ${toWords(cents)} ${cent} only`
    : `${toWords(whole)} ${unit} only`;
}

const DEFAULT_TERMS_INVOICE = [
  "Payment is due within 14 days of the invoice date.",
  "Please quote the invoice number as the payment reference.",
  "Late payments attract interest at 2% per month.",
  "Goods and services remain the property of Enpassent (Pvt) Ltd until paid in full.",
];
const DEFAULT_TERMS_QUOTE = [
  "This quotation is valid until the date shown above.",
  "Prices are subject to change after the validity period.",
  "A 50% deposit is required to commence work.",
  "This quotation is not a tax invoice.",
];

/**
 * Generates a professional invoice/quotation PDF — brand band, meta card,
 * itemized table with codes/units/discounts, boxed totals with paid/balance,
 * amount in words, payment details, terms and signature blocks.
 */
export async function downloadBusinessDoc(d: BusinessDoc) {
  const pdfMake = await getPdfMake();
  const sym = SYM[d.currency];
  const isQuote = d.kind === "quotation";
  const accent = isQuote ? "#d97706" : "#1d4ed8";
  const accentSoft = isQuote ? "#fef3c7" : "#eff6ff";
  const status: DocStatus = d.status ?? (isQuote ? "pending" : "pending");

  const lineNet = (l: DocLine) => l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);
  const subtotal = d.lines.reduce((s, l) => s + lineNet(l), 0);
  const discount = ((d.discountPct ?? 0) / 100) * subtotal;
  const shipping = d.shipping ?? 0;
  const taxable = subtotal - discount + shipping;
  const vat = (d.vatRate ?? 0) * taxable;
  const total = taxable + vat;
  const paid = d.amountPaid ?? (status === "paid" ? total : 0);
  const balance = Math.max(0, total - paid);

  const money = (v: number) =>
    `${sym} ${v.toLocaleString("en-ZW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const metaCell = (label: string, value: string): Content => ({
    stack: [
      { text: label.toUpperCase(), fontSize: 7, bold: true, color: "#6b7280" },
      { text: value, fontSize: 10, margin: [0, 2, 0, 0] },
    ],
    margin: [8, 6, 8, 6],
  });

  const totalsRow = (label: string, value: string, opts?: { bold?: boolean; fill?: string; color?: string; size?: number }) => [
    { text: label, fontSize: opts?.size ?? 9.5, bold: opts?.bold, color: opts?.color ?? "#374151", border: [false, false, false, false] as [boolean, boolean, boolean, boolean] },
    { text: value, fontSize: opts?.size ?? 9.5, bold: opts?.bold, color: opts?.color ?? "#111827", alignment: "right" as const, border: [false, false, false, false] as [boolean, boolean, boolean, boolean] },
  ];

  const content: Content[] = [
    // ── Brand band ──
    {
      canvas: [{ type: "rect", x: 0, y: 0, w: 499, h: 4, color: accent }],
      margin: [0, 0, 0, 14],
    },
    // ── Header: company + doc title ──
    {
      columns: [
        {
          width: "auto",
          table: {
            widths: [34],
            body: [[{ text: "E", fontSize: 20, bold: true, color: "#ffffff", alignment: "center", margin: [0, 5, 0, 5] }]],
          },
          layout: {
            fillColor: () => "#0f2b4c",
            hLineWidth: () => 0,
            vLineWidth: () => 0,
          },
        },
        {
          width: "*",
          stack: [
            { text: COMPANY.name, fontSize: 15, bold: true, color: "#0f2b4c" },
            { text: COMPANY.tagline, fontSize: 8, color: "#6b7280", margin: [0, 1, 0, 0] },
            {
              text: `${COMPANY.address} · ${COMPANY.phone} · ${COMPANY.email}`,
              fontSize: 7.5, color: "#9ca3af", margin: [0, 3, 0, 0],
            },
            { text: `${COMPANY.vatNo} · ${COMPANY.tin}`, fontSize: 7.5, color: "#9ca3af", margin: [0, 1, 0, 0] },
          ],
          margin: [10, 0, 0, 0],
        },
        {
          width: "auto",
          stack: [
            {
              text: isQuote ? "QUOTATION" : "TAX INVOICE",
              fontSize: 18, bold: true, alignment: "right", color: accent,
            },
            { text: d.number, fontSize: 10.5, bold: true, alignment: "right", color: "#374151", margin: [0, 3, 0, 0] },
            {
              table: {
                widths: ["auto"],
                body: [[{
                  text: status.toUpperCase(),
                  fontSize: 8, bold: true, color: "#ffffff",
                  margin: [8, 2.5, 8, 2.5],
                }]],
              },
              layout: {
                fillColor: () => STATUS_COLOR[status],
                hLineWidth: () => 0,
                vLineWidth: () => 0,
              },
              alignment: "right",
              margin: [0, 5, 0, 0],
            },
          ],
        },
      ],
      columnGap: 8,
    },
    // ── Meta strip ──
    {
      margin: [0, 16, 0, 0],
      table: {
        widths: ["*", "*", "*", "*"],
        body: [[
          metaCell("Issue date", d.issueDate),
          metaCell(isQuote ? "Valid until" : "Due date", (isQuote ? d.validUntil : d.dueDate) ?? "—"),
          metaCell(isQuote ? "Reference" : "PO / Reference", d.poNumber ?? d.reference ?? "—"),
          metaCell("Currency", d.currency === "ZWG" ? "ZiG (Zimbabwe Gold)" : "USD"),
        ]],
      },
      layout: {
        fillColor: () => "#f8fafc",
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: "#e5e7eb",
        vLineColor: "#e5e7eb",
      },
    },
    // ── Bill To / From ──
    {
      columns: [
        {
          width: "55%",
          stack: [
            { text: isQuote ? "QUOTATION FOR" : "BILL TO", fontSize: 8, bold: true, color: accent, margin: [0, 0, 0, 4] },
            { text: d.client, fontSize: 12, bold: true },
            ...(d.clientContact ? [{ text: `Attn: ${d.clientContact}`, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
            ...(d.clientAddress ? [{ text: d.clientAddress, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
            ...(d.clientEmail ? [{ text: d.clientEmail, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
            ...(d.clientPhone ? [{ text: d.clientPhone, fontSize: 9, color: "#4b5563", margin: [0, 1, 0, 0] as [number, number, number, number] } as Content] : []),
            ...(d.clientVat ? [{ text: `VAT: ${d.clientVat}`, fontSize: 9, color: "#4b5563", margin: [0, 1, 0, 0] as [number, number, number, number] } as Content] : []),
          ],
        },
        {
          width: "45%",
          stack: [
            { text: "FROM", fontSize: 8, bold: true, color: "#6b7280", margin: [0, 0, 0, 4] },
            { text: COMPANY.name, fontSize: 10.5, bold: true },
            { text: COMPANY.address, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] },
            { text: `${COMPANY.email} · ${COMPANY.web}`, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] },
            ...(d.preparedBy ? [{ text: `Prepared by: ${d.preparedBy}`, fontSize: 9, color: "#4b5563", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
          ],
        },
      ],
      margin: [0, 16, 0, 0],
    },
    // ── Line items ──
    {
      margin: [0, 18, 0, 0],
      table: {
        headerRows: 1,
        widths: [18, 52, "*", 30, 34, 62, 36, 66],
        body: [
          [
            { text: "#", style: "th" },
            { text: "Code", style: "th" },
            { text: "Description", style: "th" },
            { text: "Qty", style: "th", alignment: "right" },
            { text: "Unit", style: "th" },
            { text: "Unit Price", style: "th", alignment: "right" },
            { text: "Disc %", style: "th", alignment: "right" },
            { text: "Amount", style: "th", alignment: "right" },
          ],
          ...d.lines.map((l, i) => [
            { text: String(i + 1), style: "td", color: "#9ca3af" },
            { text: l.code ?? "—", style: "td", color: "#6b7280" },
            { text: l.description, style: "td" },
            { text: String(l.qty), style: "td", alignment: "right" as const },
            { text: l.unit ?? "—", style: "td", color: "#6b7280" },
            { text: money(l.unitPrice), style: "td", alignment: "right" as const },
            { text: l.discountPct ? `${l.discountPct}%` : "—", style: "td", alignment: "right" as const, color: l.discountPct ? "#b91c1c" : "#9ca3af" },
            { text: money(lineNet(l)), style: "td", alignment: "right" as const, bold: true },
          ]),
        ],
      },
      layout: {
        fillColor: (rowIndex: number) =>
          rowIndex === 0 ? "#0f2b4c" : rowIndex % 2 === 0 ? "#f9fafb" : null,
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
        vLineWidth: () => 0,
        hLineColor: "#e5e7eb",
        paddingTop: () => 6,
        paddingBottom: () => 6,
        paddingLeft: () => 6,
        paddingRight: () => 6,
      },
    },
    // ── Totals panel ──
    {
      columns: [
        {
          width: "*",
          stack: [
            {
              text: [
                { text: "Amount in words: ", bold: true, fontSize: 8.5, color: "#6b7280" },
                { text: amountInWords(total, sym), fontSize: 8.5, italics: true, color: "#374151" },
              ],
              margin: [0, 14, 24, 0],
            },
          ],
        },
        {
          width: 220,
          margin: [0, 8, 0, 0],
          table: {
            widths: ["*", "auto"],
            body: [
              totalsRow("Subtotal", money(subtotal)),
              ...(d.discountPct ? [totalsRow(`Discount (${d.discountPct}%)`, `-${money(discount)}`, { color: "#b91c1c" })] : []),
              ...(shipping ? [totalsRow("Shipping / Handling", money(shipping))] : []),
              ...(d.vatRate ? [totalsRow(`VAT (${(d.vatRate * 100).toFixed(1)}%)`, money(vat))] : []),
              totalsRow("TOTAL", money(total), { bold: true, fill: accentSoft, size: 11, color: "#0f2b4c" }),
              ...(paid > 0 ? [totalsRow("Amount Paid", `-${money(paid)}`, { color: "#15803d" })] : []),
              ...(paid > 0 ? [totalsRow("Balance Due", money(balance), { bold: true, color: balance > 0 ? "#b91c1c" : "#15803d" })] : []),
            ],
          },
          layout: {
            fillColor: (rowIndex: number, node: { table: { body: unknown[] } }) => {
              const totalIdx = (d.discountPct ? 1 : 0) + (shipping ? 1 : 0) + (d.vatRate ? 1 : 0) + 1;
              return rowIndex === totalIdx ? accentSoft : null;
            },
            hLineWidth: () => 0.25,
            vLineWidth: () => 0,
            hLineColor: "#e5e7eb",
            paddingTop: () => 4,
            paddingBottom: () => 4,
            paddingLeft: () => 8,
            paddingRight: () => 8,
          },
        },
      ],
    },
    // ── Payment details + terms ──
    {
      columns: [
        {
          width: "48%",
          stack: [
            { text: isQuote ? "PAYMENT DETAILS (ON ACCEPTANCE)" : "PAYMENT DETAILS", fontSize: 8, bold: true, color: accent, margin: [0, 0, 0, 4] },
            { text: `Bank: ${COMPANY.bank.bank}`, fontSize: 8.5, color: "#374151" },
            { text: `Account Name: ${COMPANY.bank.accountName}`, fontSize: 8.5, color: "#374151", margin: [0, 1.5, 0, 0] },
            { text: `Account No: ${COMPANY.bank.accountNo}`, fontSize: 8.5, color: "#374151", margin: [0, 1.5, 0, 0] },
            { text: `Branch: ${COMPANY.bank.branch}`, fontSize: 8.5, color: "#374151", margin: [0, 1.5, 0, 0] },
            { text: COMPANY.bank.ecocash, fontSize: 8.5, color: "#374151", margin: [0, 1.5, 0, 0] },
            { text: `Reference: ${d.number}`, fontSize: 8.5, bold: true, color: "#0f2b4c", margin: [0, 3, 0, 0] },
          ],
          margin: [0, 0, 12, 0],
        },
        {
          width: "52%",
          stack: [
            { text: "TERMS & CONDITIONS", fontSize: 8, bold: true, color: "#6b7280", margin: [0, 0, 0, 4] },
            ...(d.terms ?? (isQuote ? DEFAULT_TERMS_QUOTE : DEFAULT_TERMS_INVOICE)).map((t, i) => ({
              text: `${i + 1}.  ${t}`,
              fontSize: 8,
              color: "#4b5563",
              margin: [0, 1.5, 0, 0] as [number, number, number, number],
            })),
          ],
        },
      ],
      margin: [0, 20, 0, 0],
    },
    // ── Notes ──
    ...(d.notes
      ? [{
          stack: [
            { text: "NOTES", fontSize: 8, bold: true, color: "#6b7280", margin: [0, 0, 0, 3] as [number, number, number, number] },
            { text: d.notes, fontSize: 8.5, color: "#4b5563" },
          ],
          margin: [0, 16, 0, 0] as [number, number, number, number],
        } as Content]
      : []),
    // ── Signature blocks ──
    {
      columns: [
        signatureBlock("Prepared by", d.preparedBy ?? ""),
        signatureBlock("Authorized signature", ""),
        signatureBlock(isQuote ? "Client acceptance" : "Received by", ""),
      ],
      columnGap: 24,
      margin: [0, 34, 0, 0],
    },
  ];

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [48, 40, 48, 64],
    watermark: ["paid", "overdue", "draft", "accepted", "declined"].includes(status)
      ? { text: status.toUpperCase(), color: STATUS_COLOR[status], opacity: 0.12, bold: true, fontSize: 90, angle: -35 }
      : isQuote
        ? { text: "QUOTATION", color: accent, opacity: 0.08, bold: true, fontSize: 90, angle: -35 }
        : undefined,
    footer: (page: number, pages: number) => ({
      stack: [
        { canvas: [{ type: "line", x1: 48, y1: 0, x2: 547, y2: 0, lineColor: "#e5e7eb", lineWidth: 0.5 }] },
        {
          columns: [
            {
              text: `Thank you for your business · ${COMPANY.name} · ${COMPANY.web}`,
              fontSize: 7.5, color: "#9ca3af",
            },
            { text: `Page ${page} of ${pages}`, fontSize: 7.5, color: "#9ca3af", alignment: "right" },
          ],
          margin: [48, 6, 48, 0],
        },
      ],
    }),
    content,
    styles: {
      th: { fontSize: 8, bold: true, color: "#ffffff" },
      td: { fontSize: 9, color: "#111827" },
    },
  };
  pdfMake.createPdf(definition).download(`${d.kind}-${d.number}.pdf`);
}

function signatureBlock(label: string, name: string): Content {
  return {
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 140, y2: 0, lineColor: "#9ca3af", lineWidth: 0.75 }] },
      { text: label, fontSize: 8, bold: true, color: "#6b7280", margin: [0, 4, 0, 0] },
      ...(name ? [{ text: name, fontSize: 8.5, color: "#374151", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
      { text: "Date: ______________", fontSize: 8, color: "#9ca3af", margin: [0, 4, 0, 0] },
    ],
  };
}
