"use client";

import { getPdfMake } from "@/lib/export";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Currency } from "@/types";

export interface DocLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface BusinessDoc {
  kind: "invoice" | "quotation";
  number: string;
  client: string;
  clientAddress?: string;
  issueDate: string;
  dueDate?: string;
  validUntil?: string;
  currency: Currency;
  lines: DocLine[];
  vatRate?: number;
  notes?: string;
}

const SYM: Record<Currency, string> = { USD: "USD", ZWG: "ZiG" };

/**
 * Generates a professional invoice/quotation PDF — branded header,
 * line-items table with totals, VAT, terms, and banking details.
 */
export async function downloadBusinessDoc(d: BusinessDoc) {
  const pdfMake = await getPdfMake();
  const subtotal = d.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vat = (d.vatRate ?? 0) * subtotal;
  const total = subtotal + vat;
  const sym = SYM[d.currency];
  const isQuote = d.kind === "quotation";

  const money = (v: number) =>
    `${sym} ${v.toLocaleString("en-ZW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [48, 44, 48, 60],
    footer: (page: number, pages: number) => ({
      columns: [
        { text: "Enpassent (Private) Limited · Harare, Zimbabwe", fontSize: 8, color: "#9ca3af" },
        { text: `Page ${page} of ${pages}`, fontSize: 8, color: "#9ca3af", alignment: "right" },
      ],
      margin: [48, 12, 48, 0],
    }),
    content: [
      {
        columns: [
          {
            stack: [
              { text: "Enpassent (Private) Limited", fontSize: 17, bold: true, color: "#0f2b4c" },
              { text: "Insurance · Reconciliation · Agent Network", fontSize: 8.5, color: "#6b7280", margin: [0, 2, 0, 0] },
            ],
          },
          {
            stack: [
              {
                text: isQuote ? "QUOTATION" : "TAX INVOICE",
                fontSize: 16, bold: true, alignment: "right",
                color: isQuote ? "#d97706" : "#1d4ed8",
              },
              { text: d.number, fontSize: 10, alignment: "right", color: "#6b7280", margin: [0, 3, 0, 0] },
            ],
          },
        ],
        columnGap: 16,
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineColor: isQuote ? "#d97706" : "#1d4ed8", lineWidth: 2 }], margin: [0, 12, 0, 14] },
      {
        columns: [
          {
            stack: [
              { text: isQuote ? "QUOTATION FOR" : "BILL TO", fontSize: 8, bold: true, color: "#6b7280" },
              { text: d.client, fontSize: 12, bold: true, margin: [0, 3, 0, 0] },
              ...(d.clientAddress ? [{ text: d.clientAddress, fontSize: 9, color: "#6b7280", margin: [0, 2, 0, 0] as [number, number, number, number] } as Content] : []),
            ],
          },
          {
            stack: [
              { text: "Issued", fontSize: 8, bold: true, color: "#6b7280", alignment: "right" },
              { text: d.issueDate, fontSize: 10, alignment: "right", margin: [0, 2, 0, 0] },
              { text: isQuote ? "Valid until" : "Due date", fontSize: 8, bold: true, color: "#6b7280", alignment: "right", margin: [0, 8, 0, 0] },
              { text: (isQuote ? d.validUntil : d.dueDate) ?? "—", fontSize: 10, alignment: "right", margin: [0, 2, 0, 0] },
              { text: "Currency", fontSize: 8, bold: true, color: "#6b7280", alignment: "right", margin: [0, 8, 0, 0] },
              { text: d.currency === "ZWG" ? "ZiG (Zimbabwe Gold)" : "USD", fontSize: 10, alignment: "right", margin: [0, 2, 0, 0] },
            ],
          },
        ],
      },
      {
        margin: [0, 20, 0, 0],
        table: {
          widths: ["*", 40, 80, 80],
          body: [
            [
              { text: "Description", style: "th" },
              { text: "Qty", style: "th", alignment: "right" },
              { text: "Unit Price", style: "th", alignment: "right" },
              { text: "Amount", style: "th", alignment: "right" },
            ],
            ...d.lines.map((l) => [
              { text: l.description, style: "td" },
              { text: String(l.qty), style: "td", alignment: "right" as const },
              { text: money(l.unitPrice), style: "td", alignment: "right" as const },
              { text: money(l.qty * l.unitPrice), style: "td", alignment: "right" as const },
            ]),
            [
              { text: "", border: [false, true, false, false] },
              { text: "", border: [false, true, false, false] },
              { text: "Subtotal", style: "sum", border: [false, true, false, false] },
              { text: money(subtotal), style: "sum", alignment: "right", border: [false, true, false, false] },
            ],
            ...(d.vatRate
              ? [[
                  { text: "", border: [false, false, false, false] },
                  { text: "", border: [false, false, false, false] },
                  { text: `VAT (${(d.vatRate * 100).toFixed(1)}%)`, style: "sum", border: [false, false, false, false] },
                  { text: money(vat), style: "sum", alignment: "right" as const, border: [false, false, false, false] },
                ]]
              : []),
            [
              { text: "", border: [false, false, false, false] },
              { text: "", border: [false, false, false, false] },
              { text: "TOTAL", style: "total", border: [false, false, false, false] },
              { text: money(total), style: "total", alignment: "right", border: [false, false, false, false] },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === 0 || i === 1 || i === node.table.body.length - 3 ? 0.5 : 0,
          vLineWidth: () => 0,
          hLineColor: "#e5e7eb",
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
      } as Content,
      ...(d.notes
        ? [{ text: [{ text: "Notes: ", bold: true }, d.notes], fontSize: 9, color: "#4b5563", margin: [0, 16, 0, 0] as [number, number, number, number] }]
        : []),
      {
        text: isQuote
          ? "This quotation is valid until the date shown above. Prices are subject to change thereafter."
          : "Payment terms: 14 days. Bank: CBZ · Account: Enpassent (Pvt) Ltd · Please quote the invoice number as reference.",
        fontSize: 8,
        color: "#9ca3af",
        margin: [0, 24, 0, 0],
      },
    ],
    styles: {
      th: { fontSize: 9, bold: true, color: "#374151", fillColor: "#f3f4f6" },
      td: { fontSize: 10, color: "#111827" },
      sum: { fontSize: 10, bold: true, color: "#111827" },
      total: { fontSize: 12, bold: true, color: "#0f2b4c", fillColor: "#eff6ff" },
    },
  };
  pdfMake.createPdf(definition).download(`${d.kind}-${d.number}.pdf`);
}
