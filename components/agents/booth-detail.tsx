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
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDate, formatMoney, formatPeriod, moduleName } from "@/lib/format";
import type { Assistant, Booth, Txn } from "@/types";

const BOOTH_LINES = [
  { item: "Insurance", expected: 1_068_320, actual: 1_068_320, variance: 0, status: "matched" as const },
  { item: "ZINARA", expected: 210_300, actual: 200_300, variance: -10_000, status: "variance" as const },
];
const BOOTH_ACTIVITY = [
  { date: "28 Aug 2026", action: "Deposit recorded", by: "Tairo Moyo" },
  { date: "24 Aug 2026", action: "Monthly recon completed", by: "System" },
  { date: "12 Aug 2026", action: "Assistant added", by: "Musa Zhou" },
];

function Tile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="tnum mt-1 text-[16px] font-bold tracking-tight sm:text-[18px]">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-success-foreground">{delta}</p>
    </div>
  );
}

function ReconTable() {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardContent className="p-4 pb-0 sm:p-5 sm:pb-0">
        <p className="text-[14px] font-semibold">Reconciliation Summary</p>
      </CardContent>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Module</th>
              <th className="px-4 py-2.5 text-right">Expected (ZIG)</th>
              <th className="px-4 py-2.5 text-right">Actual (ZIG)</th>
              <th className="px-4 py-2.5 text-right">Variance (ZIG)</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {BOOTH_LINES.map((l) => (
              <tr key={l.item}>
                <td className="px-4 py-3 font-medium">{l.item}</td>
                <td className="tnum px-4 py-3 text-right">{l.expected.toLocaleString()}</td>
                <td className="tnum px-4 py-3 text-right">{l.actual.toLocaleString()}</td>
                <td className={`tnum px-4 py-3 text-right font-medium ${l.variance !== 0 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                  {l.variance.toLocaleString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="tnum px-4 py-3 text-right">1,278,620</td>
              <td className="tnum px-4 py-3 text-right">1,268,620</td>
              <td className="tnum px-4 py-3 text-right text-warning-foreground">-10,000</td>
              <td className="px-4 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function BoothDetail({
  booth,
  assistants,
  transactions,
}: {
  booth: Booth;
  assistants: Assistant[];
  transactions: Txn[];
}) {
  const { period } = useWorkspace();

  return (
    <div className="space-y-4">
      <Link
        href="/app/booths"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to Booths
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
          <TabsTrigger value="assistants" className="rounded-none px-1 pb-2.5 text-[13px]">Assistants</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none px-1 pb-2.5 text-[13px]">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Select defaultValue={period}>
              <SelectTrigger className="h-9 w-40 bg-card text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map((i) => {
                  const d = new Date(2026, 8 - i, 1);
                  const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  return <SelectItem key={p} value={p}>{formatPeriod(p)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile label="Total Insurance" value={formatMoney(1_068_320, "ZWG")} delta="↗ 12% from last month" />
            <Tile label="Total ZINARA" value={formatMoney(210_300, "ZWG")} delta="↗ 8% from last month" />
            <Tile label="Total Deposits" value={formatMoney(800_000, "ZWG")} delta="↗ 6% from last month" />
            <Tile label="Closing Position" value={formatMoney(-58_770, "ZWG")} delta="↗ 14% from last month" />
          </div>

          <ReconTable />

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
                    <th className="px-4 py-2.5 text-right">Amount (ZIG)</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.slice(0, 4).map((t) => (
                    <tr key={t.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(t.date, "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{t.ref}</td>
                      <td className="px-4 py-3 capitalize">{t.category}</td>
                      <td className="tnum px-4 py-3 text-right">{t.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <CardContent className="flex items-center justify-between p-4 pb-0 sm:p-5 sm:pb-0">
              <p className="text-[14px] font-semibold">Booth Activity</p>
              <span className="text-[12px] font-medium text-primary">View all</span>
            </CardContent>
            <table className="mt-2 w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Activity</th>
                  <th className="px-4 py-2.5">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {BOOTH_ACTIVITY.map((a) => (
                  <tr key={a.date + a.action}>
                    <td className="px-4 py-3 text-muted-foreground">{a.date}</td>
                    <td className="px-4 py-3">{a.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <ReconTable />
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

        <TabsContent value="assistants" className="mt-4">
          <Card className="gap-0 overflow-hidden py-0 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5">Assistant</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assistants.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <AgentAvatar name={a.fullName} size="xs" />
                          <span className="font-medium">{a.fullName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{a.phone}</td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                  {assistants.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                        No assistants assigned to this booth yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="max-w-lg space-y-4 p-4 sm:p-5">
              <p className="text-[14px] font-semibold">Booth Settings</p>
              <div className="space-y-1.5">
                <Label>Booth Name</Label>
                <Input defaultValue={booth.name} className="bg-card" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input defaultValue={`${booth.location}, ${booth.province}`} className="bg-card" />
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
              <Button
                className="h-9 text-[13px]"
                onClick={() => toast.success("Booth settings saved")}
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
