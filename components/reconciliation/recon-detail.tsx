"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileWarning, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyValue } from "@/components/shared/money-value";
import { formatMoney, formatPeriod, moduleName } from "@/lib/format";
import type { Reconciliation, ReconciliationLine, Txn } from "@/types";

function SummaryTile({
  label,
  amount,
  currency,
  danger = false,
}: {
  label: string;
  amount: number;
  currency: Reconciliation["currency"];
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        danger && amount < 0
          ? "border-destructive/20 bg-destructive-soft/50"
          : "bg-card"
      }`}
    >
      <p className={`text-[11.5px] ${danger && amount < 0 ? "text-destructive" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className={`tnum mt-1 text-[15px] font-bold tracking-tight sm:text-[17px] ${danger && amount < 0 ? "text-destructive" : ""}`}>
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}

export function ReconDetail({
  recon,
  lines,
  transactions,
  isCompanyUser,
}: {
  recon: Reconciliation;
  lines: ReconciliationLine[];
  transactions: Txn[];
  isCompanyUser: boolean;
}) {
  const [discrepancyOpen, setDiscrepancyOpen] = React.useState(false);
  const [item, setItem] = React.useState<string>("");
  const [note, setNote] = React.useState("");

  function submitDiscrepancy() {
    toast.success("Discrepancy submitted", {
      description: "The reconciliation team will review it with your attached evidence.",
    });
    setDiscrepancyOpen(false);
    setItem("");
    setNote("");
  }

  return (
    <div className="space-y-4">
      <Link
        href={isCompanyUser ? "/app/reconciliation" : "/app/dashboard"}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {isCompanyUser ? "Batch results" : "Dashboard"}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight sm:text-[24px]">
            Reconciliation Details
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            <span className="font-mono">{recon.id}</span> · {recon.agentName} ·{" "}
            {moduleName(recon.module)} · {formatPeriod(recon.period)} · v{recon.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={recon.status} />
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12.5px]">
            <Download className="size-4" aria-hidden /> View Full Report
          </Button>
          <Dialog open={discrepancyOpen} onOpenChange={setDiscrepancyOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-[12.5px] text-warning-foreground">
                <FileWarning className="size-4" aria-hidden /> Report Discrepancy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Report a Discrepancy</DialogTitle>
                <DialogDescription>
                  Select the affected item and describe the issue. Evidence can be
                  attached. Submissions are reviewed by the reconciliation team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Affected item</Label>
                  <Select value={item} onValueChange={setItem}>
                    <SelectTrigger aria-label="Affected item">
                      <SelectValue placeholder="Select item or transaction" />
                    </SelectTrigger>
                    <SelectContent>
                      {lines.map((l) => (
                        <SelectItem key={l.item} value={l.item}>
                          {l.item}
                        </SelectItem>
                      ))}
                      {transactions.slice(0, 5).map((t) => (
                        <SelectItem key={t.id} value={`txn:${t.id}`}>
                          {t.title} ({formatMoney(t.amount, t.currency)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recon-note">What looks wrong?</Label>
                  <Textarea
                    id="recon-note"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Deposit on 15 Aug was POS-settled but shown as cash…"
                  />
                </div>
                <Button variant="outline" className="w-full gap-2" type="button">
                  <Paperclip className="size-4" aria-hidden /> Attach evidence (optional)
                </Button>
                <Button
                  className="w-full"
                  disabled={!item || note.trim().length < 10}
                  onClick={submitDiscrepancy}
                >
                  Submit discrepancy
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList variant="line" className="w-full justify-start gap-5 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="summary" className="rounded-none px-1 pb-2.5 text-[13px]">Summary</TabsTrigger>
          <TabsTrigger value="breakdown" className="rounded-none px-1 pb-2.5 text-[13px]">Breakdown</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-none px-1 pb-2.5 text-[13px]">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <SummaryTile label="Opening Position" amount={recon.openingPosition} currency={recon.currency} />
            <SummaryTile label="Total Insurance" amount={recon.insurance} currency={recon.currency} />
            <SummaryTile label="Total ZINARA" amount={recon.zinara} currency={recon.currency} />
            <SummaryTile label="Total Deposits" amount={recon.deposits} currency={recon.currency} />
            <SummaryTile label="Adjustments" amount={recon.adjustments} currency={recon.currency} />
            <SummaryTile label="Closing Position" amount={recon.closingPosition} currency={recon.currency} danger />
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Published snapshots are immutable — later recalculations create a new
            version instead of editing history.
          </p>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5 text-right">Expected</th>
                    <th className="px-4 py-2.5 text-right">Actual</th>
                    <th className="px-4 py-2.5 text-right">Variance</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((l) => (
                    <tr key={l.item} className="hover:bg-surface-hover">
                      <td className="px-4 py-3 font-medium">{l.item}</td>
                      <td className="tnum px-4 py-3 text-right">{l.expected.toLocaleString()}</td>
                      <td className="tnum px-4 py-3 text-right">{l.actual.toLocaleString()}</td>
                      <td className={`tnum px-4 py-3 text-right font-medium ${l.variance !== 0 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                        {l.variance > 0 ? `+${l.variance.toLocaleString()}` : l.variance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-2.5">
          {transactions.map((t) => (
            <Card key={t.id} className="gap-0 py-0 shadow-xs">
              <CardContent className="flex items-center gap-3 p-3.5">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                    t.category === "insurance"
                      ? "bg-primary-soft text-primary"
                      : t.category === "zinara"
                        ? "bg-warning-soft text-warning-foreground"
                        : "bg-success-soft text-success-foreground"
                  }`}
                >
                  {t.category === "insurance" ? "IN" : t.category === "zinara" ? "ZN" : "DP"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{t.title}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {t.subtitle} · {t.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-[13.5px] font-bold">{formatMoney(t.amount, t.currency)}</p>
                  <StatusBadge status={t.status} className="mt-0.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
