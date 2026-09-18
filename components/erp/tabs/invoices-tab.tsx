"use client";

import * as React from "react";
import {
  FileText,
  DollarSign,
  Receipt,
  TrendingDown,
  Ellipsis,
} from "lucide-react";
import { downloadBusinessDoc, type DocLine } from "@/lib/erp/document-pdf";
import type { Currency } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { ExportButton } from "@/components/shared/export-button";
import { MetricCard } from "../shared";

interface BizDocRow {
  id: string;
  kind: "invoice" | "quotation";
  client: string;
  clientContact?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  poNumber?: string;
  amount: number;
  date: string;
  due?: string;
  validUntil?: string;
  status: "paid" | "pending" | "overdue" | "draft" | "accepted" | "declined";
  lines: DocLine[];
  currency: Currency;
  discountPct?: number;
  vatRate?: number;
  amountPaid?: number;
  notes?: string;
}

export default function InvoicesTab() {
  const [docs, setDocs] = React.useState<BizDocRow[]>([
    { id: "INV-2026-001", kind: "invoice", client: "Econet Wireless", clientContact: "T. Makoni", clientAddress: "Econet Park, Borrowdale, Harare", clientEmail: "accounts@econet.co.zw", clientPhone: "+263 77 222 0000", poNumber: "PO-ECO-4471", amount: 187500, date: "2026-09-01", due: "2026-09-15", status: "paid", vatRate: 0.155, amountPaid: 187500, notes: "Settlement via RTGS — reference INV-2026-001.", lines: [{ code: "SVC-REC", description: "Reconciliation services — August 2026", qty: 1, unit: "svc", unitPrice: 187500 }], currency: "ZWG" },
    { id: "INV-2026-002", kind: "invoice", client: "ZINARA Harare", clientContact: "Procurement Dept", clientAddress: "Runhare House, Harare", clientEmail: "procurement@zinara.co.zw", amount: 45200, date: "2026-09-03", due: "2026-09-17", status: "pending", vatRate: 0.155, lines: [{ code: "MOD-ZIN", description: "ZINARA reconciliation module", qty: 1, unit: "svc", unitPrice: 45200 }], currency: "ZWG" },
    { id: "INV-2026-003", kind: "invoice", client: "CBZ Bank", clientEmail: "vendor.payables@cbz.co.zw", amount: 92000, date: "2026-09-05", due: "2026-09-19", status: "pending", vatRate: 0.155, lines: [{ code: "SVC-AGT", description: "Agent network reconciliation", qty: 1, unit: "svc", unitPrice: 92000 }], currency: "ZWG" },
    { id: "INV-2026-004", kind: "invoice", client: "Mutare Motors", clientPhone: "+263 20 64 321", amount: 18500, date: "2026-09-07", due: "2026-09-21", status: "overdue", vatRate: 0.155, notes: "Second reminder sent 2026-09-22.", lines: [{ description: "Monthly reconciliation", qty: 1, unit: "mo", unitPrice: 18500 }], currency: "ZWG" },
    { id: "QT-2026-001", kind: "quotation", client: "Bulawayo Insurers", clientContact: "R. Nkomo", clientEmail: "rnkomo@byo-insurers.co.zw", amount: 64000, date: "2026-09-10", validUntil: "2026-09-30", status: "pending", vatRate: 0.155, discountPct: 5, notes: "Includes onboarding of 12 agents.", lines: [{ code: "SETUP-Q4", description: "Q4 reconciliation setup", qty: 1, unit: "svc", unitPrice: 64000 }], currency: "ZWG" },
  ]);
  const [createOpen, setCreateOpen] = React.useState<"invoice" | "quotation" | null>(null);
  const [docTab, setDocTab] = React.useState<"invoice" | "quotation">("invoice");

  const invoices = docs.filter((d) => d.kind === "invoice");
  const quotes = docs.filter((d) => d.kind === "quotation");
  const shown = docTab === "invoice" ? invoices : quotes;

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  async function downloadDoc(d: BizDocRow) {
    try {
      await downloadBusinessDoc({
        kind: d.kind,
        number: d.id,
        status: d.status,
        client: d.client,
        clientContact: d.clientContact,
        clientAddress: d.clientAddress,
        clientEmail: d.clientEmail,
        clientPhone: d.clientPhone,
        poNumber: d.poNumber,
        issueDate: d.date,
        dueDate: d.due,
        validUntil: d.validUntil,
        currency: d.currency,
        lines: d.lines,
        discountPct: d.discountPct,
        vatRate: d.vatRate ?? 0.155,
        amountPaid: d.amountPaid,
        notes: d.notes,
      });
      toast.success(`${d.kind === "invoice" ? "Invoice" : "Quotation"} downloaded`, { description: `${d.id}.pdf` });
    } catch (err) {
      toast.error("Download failed", { description: err instanceof Error ? err.message : "Could not generate PDF." });
    }
  }

  function statusBadge(status: BizDocRow["status"]) {
    const map: Record<string, string> = {
      paid: "border-transparent bg-success-soft text-success-foreground",
      accepted: "border-transparent bg-success-soft text-success-foreground",
      pending: "border-transparent bg-warning-soft text-warning-foreground",
      overdue: "border-transparent bg-destructive-soft text-destructive",
      declined: "border-transparent bg-destructive-soft text-destructive",
      draft: "border-transparent bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={map[status]}>{status}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={FileText} label="Total Invoices" value={String(invoices.length)} />
        <MetricCard icon={DollarSign} label="Paid" value={formatMoney(totalPaid)} trend="2 paid" trendUp />
        <MetricCard icon={Receipt} label="Pending" value={formatMoney(totalPending)} />
        <MetricCard icon={TrendingDown} label="Overdue" value={formatMoney(totalOverdue)} />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">
            {docTab === "invoice" ? "Invoices" : "Quotations"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex overflow-hidden rounded-lg border text-[12px]">
              {(["invoice", "quotation"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setDocTab(k)}
                  className={`px-3 py-1.5 font-medium capitalize transition-colors ${docTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {k === "invoice" ? `Invoices (${invoices.length})` : `Quotations (${quotes.length})`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                filename={`${docTab}-export`}
                rows={shown.length}
                label="Export"
                title={docTab === "invoice" ? "QuickRecon — Invoices" : "QuickRecon — Quotations"}
                data={{
                  columns: [docTab === "invoice" ? "Invoice #" : "Quote #", "Client", "Amount", "Currency", "Issued", docTab === "invoice" ? "Due" : "Valid Until", "Status"],
                  rows: shown.map((d) => [d.id, d.client, d.amount, d.currency, d.date, d.due ?? d.validUntil ?? "", d.status]),
                }}
              />
              <Button className="h-9 gap-1.5 text-[13px]" onClick={() => setCreateOpen(docTab)}>
                <FileText className="size-4" aria-hidden /> New {docTab === "invoice" ? "Invoice" : "Quotation"}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">{docTab === "invoice" ? "Invoice #" : "Quote #"}</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Issued</th>
                  <th className="px-3 py-2.5">{docTab === "invoice" ? "Due" : "Valid Until"}</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="w-10 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-hover">
                    <td className="font-mono text-[12px] px-3 py-2.5">{d.id}</td>
                    <td className="px-3 py-2.5 font-medium">{d.client}</td>
                    <td className="tnum px-3 py-2.5 text-right">{d.amount.toLocaleString()}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{d.date}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{d.due ?? d.validUntil}</td>
                    <td className="px-3 py-2.5">{statusBadge(d.status)}</td>
                    <td className="px-3 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.id}`}>
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => downloadDoc(d)}>
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toast.success(`${d.id} marked as sent`, { description: `Delivered to ${d.client}` })}>
                            Mark Sent
                          </DropdownMenuItem>
                          {d.kind === "quotation" && d.status === "pending" && (
                            <DropdownMenuItem onSelect={() => setDocs((all) => all.map((x) => x.id === d.id ? { ...x, status: "accepted" as const } : x))}>
                              Mark Accepted
                            </DropdownMenuItem>
                          )}
                          {d.kind === "invoice" && d.status === "pending" && (
                            <DropdownMenuItem onSelect={() => setDocs((all) => all.map((x) => x.id === d.id ? { ...x, status: "paid" as const } : x))}>
                              Mark Paid
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {createOpen && (
        <BizDocDialog
          kind={createOpen}
          onClose={() => setCreateOpen(null)}
          onCreate={(d) => {
            setDocs((all) => [d, ...all]);
            setCreateOpen(null);
            toast.success(`${d.kind === "invoice" ? "Invoice" : "Quotation"} created`, { description: `${d.id} · ${d.client}` });
          }}
        />
      )}
    </div>
  );
}

/** Create invoice/quotation dialog with line items. */
function BizDocDialog({
  kind,
  onClose,
  onCreate,
}: {
  kind: "invoice" | "quotation";
  onClose: () => void;
  onCreate: (d: BizDocRow) => void;
}) {
  const [client, setClient] = React.useState("");
  const [clientContact, setClientContact] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [poNumber, setPoNumber] = React.useState("");
  const [currency, setCurrency] = React.useState<Currency>("ZWG");
  const [discountPct, setDiscountPct] = React.useState("");
  const [applyVat, setApplyVat] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DocLine[]>([{ description: "", qty: 1, unit: "svc", unitPrice: 0 }]);

  const lineNet = (l: DocLine) => l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);
  const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
  const discount = (parseFloat(discountPct) || 0) / 100 * subtotal;
  const vat = applyVat ? 0.155 * (subtotal - discount) : 0;
  const total = subtotal - discount + vat;
  const sym = currency === "ZWG" ? "ZiG" : "USD";
  const fmt = (v: number) => `${sym} ${v.toLocaleString("en-ZW", { minimumFractionDigits: 2 })}`;

  function updateLine(i: number, field: keyof DocLine, v: string | number) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [field]: v } : l)));
  }

  function create() {
    if (!client.trim()) { toast.error("Client name required"); return; }
    if (lines.some((l) => !l.description.trim())) { toast.error("All line items need a description"); return; }
    const prefix = kind === "invoice" ? "INV" : "QT";
    const id = `${prefix}-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
    onCreate({
      id,
      kind,
      client: client.trim(),
      clientContact: clientContact.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      poNumber: poNumber.trim() || undefined,
      amount: total,
      date: new Date().toISOString().slice(0, 10),
      due: kind === "invoice" ? new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10) : undefined,
      validUntil: kind === "quotation" ? new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10) : undefined,
      status: "draft",
      lines,
      currency,
      discountPct: parseFloat(discountPct) || undefined,
      vatRate: applyVat ? 0.155 : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>New {kind === "invoice" ? "Invoice" : "Quotation"}</DialogTitle>
          <DialogDescription>
            Full document — client details, line items with codes & discounts,
            VAT, terms and signature blocks are included in the PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client <span className="text-destructive">*</span></Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Contact Person</Label>
              <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="Attn: name" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client Email</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="accounts@client.co.zw" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client Phone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+263 …" className="h-9 bg-card" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Client Address</Label>
            <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Street, suburb, city" className="h-9 bg-card" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">{kind === "invoice" ? "PO / Reference" : "Reference"}</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZWG">ZiG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Discount %</Label>
              <Input type="number" min={0} max={100} step="0.5" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" className="h-9 bg-card" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px]">Line Items</Label>
            <div className="grid grid-cols-[70px_1fr_52px_56px_88px_56px_28px] gap-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase">
              <span>Code</span><span>Description</span><span>Qty</span><span>Unit</span><span>Price</span><span>Disc%</span><span></span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[70px_1fr_52px_56px_88px_56px_28px] items-center gap-1.5">
                <Input value={l.code ?? ""} onChange={(e) => updateLine(i, "code", e.target.value)} placeholder="SKU" className="h-8.5 bg-card text-[12px]" />
                <Input value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Description" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(i, "qty", parseInt(e.target.value) || 1)} className="h-8.5 bg-card text-[12px]" />
                <Input value={l.unit ?? ""} onChange={(e) => updateLine(i, "unit", e.target.value)} placeholder="svc" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={0} max={100} value={l.discountPct ?? ""} onChange={(e) => updateLine(i, "discountPct", parseFloat(e.target.value) || 0)} placeholder="0" className="h-8.5 bg-card text-[12px]" />
                <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line">
                  ×
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]" onClick={() => setLines((ls) => [...ls, { description: "", qty: 1, unit: "svc", unitPrice: 0 }])}>
              + Add line
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-[12.5px] font-medium">Apply VAT (15.5%)</p>
              <p className="text-[11px] text-muted-foreground">ZIMRA rate — added after discount.</p>
            </div>
            <Switch checked={applyVat} onCheckedChange={setApplyVat} aria-label="Apply VAT" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Settlement via RTGS — quote the invoice number." className="bg-card text-[12.5px]" />
          </div>

          <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-[12.5px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tnum">{fmt(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount ({discountPct}%)</span><span className="tnum">-{fmt(discount)}</span></div>}
            {applyVat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15.5%)</span><span className="tnum">{fmt(vat)}</span></div>}
            <div className="flex justify-between border-t pt-1.5 text-[14px] font-bold"><span>Total</span><span className="tnum">{fmt(total)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={create}>Create {kind === "invoice" ? "Invoice" : "Quotation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
