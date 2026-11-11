"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDate, formatMoney, formatPeriod, moduleName } from "@/lib/format";
import type { Booth, Currency, Reconciliation, Txn } from "@/types";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="tnum mt-1 text-[16px] font-bold tracking-tight sm:text-[18px]">{value}</p>
    </div>
  );
}

function currencyLabel(currency: Currency) {
  return currency === "USD" ? "USD" : "ZiG";
}

function ReconTable({ rows }: { rows: Reconciliation[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
        No reconciliation is stored for this agent in the selected period.
      </p>
    );
  }
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardContent className="p-4 pb-0 sm:p-5 sm:pb-0">
        <p className="text-[14px] font-semibold">Reconciliation Summary</p>
      </CardContent>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Module</th>
              <th className="px-4 py-2.5 text-right">Insurance</th>
              <th className="px-4 py-2.5 text-right">ZINARA</th>
              <th className="px-4 py-2.5 text-right">Deposits</th>
              <th className="px-4 py-2.5 text-right">Closing</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/app/reconciliation/${r.id}`} className="hover:text-primary hover:underline">
                    {moduleName(r.module)} · {currencyLabel(r.currency)}
                  </Link>
                </td>
                <td className="tnum px-4 py-3 text-right">{formatMoney(r.insurance, r.currency)}</td>
                <td className="tnum px-4 py-3 text-right">{formatMoney(r.zinara, r.currency)}</td>
                <td className="tnum px-4 py-3 text-right">{formatMoney(r.deposits, r.currency)}</td>
                <td className={`tnum px-4 py-3 text-right font-medium ${r.closingPosition < 0 ? "text-destructive" : ""}`}>
                  {formatMoney(r.closingPosition, r.currency)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function BoothDetail({
  booth,
  transactions,
  reconciliations,
}: {
  booth: Booth;
  transactions: Txn[];
  reconciliations: Reconciliation[];
}) {
  const { period } = useWorkspace();
  const periods = React.useMemo(() => {
    const set = new Set(reconciliations.map((r) => r.period));
    if (period) set.add(period);
    return [...set].sort().reverse();
  }, [reconciliations, period]);
  const [selectedPeriod, setSelectedPeriod] = React.useState(period);
  const rows = reconciliations.filter((r) => r.period === selectedPeriod);
  const totals = new Map<Currency, { insurance: number; zinara: number; deposits: number; closing: number }>();
  for (const r of rows) {
    const cur = totals.get(r.currency) ?? { insurance: 0, zinara: 0, deposits: 0, closing: 0 };
    cur.insurance += r.insurance;
    cur.zinara += r.zinara;
    cur.deposits += r.deposits;
    cur.closing += r.closingPosition;
    totals.set(r.currency, cur);
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/app/agents/${booth.agentId}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to Agent
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight sm:text-[24px]">
            <MapPin className="size-5 text-primary" aria-hidden />
            {booth.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {booth.location}, {booth.province}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[13px]"
            onClick={() => toast.info("Edit Booth", { description: "Booth editing opens once settings are enabled." })}
          >
            <Pencil className="size-3.5" aria-hidden /> Edit Booth
          </Button>
          <StatusBadge status={booth.status} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="overview" className="rounded-none px-1 pb-2.5 text-[13px]">Overview</TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-none px-1 pb-2.5 text-[13px]">Reconciliation</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-none px-1 pb-2.5 text-[13px]">Transactions</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none px-1 pb-2.5 text-[13px]">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {periods.length > 0 && (
            <div className="flex justify-end">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-9 w-40 bg-card text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>{formatPeriod(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {[...totals.entries()].map(([currency, s]) => (
            <div key={currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile label={`Total Insurance (${currencyLabel(currency)})`} value={formatMoney(s.insurance, currency)} />
              <Tile label={`Total ZINARA (${currencyLabel(currency)})`} value={formatMoney(s.zinara, currency)} />
              <Tile label={`Total Deposits (${currencyLabel(currency)})`} value={formatMoney(s.deposits, currency)} />
              <Tile label={`Closing Position (${currencyLabel(currency)})`} value={formatMoney(s.closing, currency)} />
            </div>
          ))}

          <ReconTable rows={rows} />

          <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <CardContent className="p-4 pb-0 sm:p-5 sm:pb-0">
              <p className="text-[14px] font-semibold">Recent Transactions</p>
            </CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                        No transactions are stored for this booth.
                      </td>
                    </tr>
                  )}
                  {transactions.slice(0, 4).map((t) => (
                    <tr key={t.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(t.date, "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{t.ref}</td>
                      <td className="px-4 py-3 capitalize">{t.category}</td>
                      <td className="tnum px-4 py-3 text-right">{formatMoney(t.amount, t.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <ReconTable rows={rows} />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-2.5">
          {transactions.length === 0 && (
            <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
              No transactions are stored for this booth.
            </p>
          )}
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
                    {t.subtitle} · {formatDate(t.date, "dd MMM yyyy")}
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

        <TabsContent value="settings" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="max-w-lg space-y-4 p-4 sm:p-5">
              <p className="text-[14px] font-semibold">Booth Settings</p>
              <div className="space-y-1.5">
                <Label>Booth Name</Label>
                <Input defaultValue={booth.name} readOnly className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input defaultValue={`${booth.location}, ${booth.province}`} readOnly className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Modules</Label>
                <p className="text-[13px] text-muted-foreground">
                  {booth.modules.map(moduleName).join(" + ")}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[12.5px] text-muted-foreground">Reports:</span>
                {(["PDF", "Excel"] as const).map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium">
                    {f === "PDF" ? <FileText className="size-3.5 text-destructive" aria-hidden /> : <FileSpreadsheet className="size-3.5 text-success-foreground" aria-hidden />}
                    {f}
                  </span>
                ))}
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                Booth name and location come from the agent record. This screen does not save edits yet.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
