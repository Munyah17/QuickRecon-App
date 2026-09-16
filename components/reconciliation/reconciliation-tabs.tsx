"use client";

import * as React from "react";
import Link from "next/link";
import {
  Send,
  TriangleAlert,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { MoneyValue } from "@/components/shared/money-value";
import { ExportButton } from "@/components/shared/export-button";
import { BatchReview } from "@/components/reconciliation/batch-review";
import { formatMoney, formatPeriod, moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { Reconciliation, Txn } from "@/types";
import type { getReconciliationDocuments } from "@/lib/data";

type ReconDocument = Awaited<ReturnType<typeof getReconciliationDocuments>>[number];

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "breakdowns", label: "Breakdowns" },
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
] as const;

/**
 * Reconciliation workspace — Summary (batch review) · Breakdowns
 * (per-agent consolidated single-row view) · Transactions · Documents.
 * Alarm lives at /app/reconciliation/exceptions.
 */
export function ReconciliationTabs({
  activeTab,
  rows,
  transactions,
  documents,
}: {
  activeTab: string;
  rows: Reconciliation[];
  transactions: Txn[];
  documents: ReconDocument[];
}) {
  const { module } = useWorkspace();
  const scoped = React.useMemo(
    () => (module === "all" ? rows : rows.filter((r) => r.module === module)),
    [rows, module]
  );

  return (
    <div className="space-y-4">
      {/* Tab bar — real links so the sidebar deep-links work */}
      <div className="flex items-center gap-5 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "summary" ? "/app/reconciliation" : `/app/reconciliation?tab=${t.id}`}
            className={
              activeTab === t.id
                ? "shrink-0 border-b-2 border-primary px-1 pb-2.5 text-[13px] font-semibold text-foreground"
                : "shrink-0 px-1 pb-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </Link>
        ))}
        <Link
          href="/app/reconciliation/exceptions"
          className="ml-auto inline-flex shrink-0 items-center gap-1 pb-2.5 text-[12.5px] font-medium text-warning-foreground hover:underline"
        >
          <TriangleAlert className="size-3.5" aria-hidden /> Alarm
        </Link>
      </div>

      {activeTab === "summary" && <BatchReview rows={rows} />}
      {activeTab === "breakdowns" && <BreakdownsView rows={scoped} />}
      {activeTab === "transactions" && <TransactionsView transactions={transactions} />}
      {activeTab === "documents" && <DocumentsView documents={documents} scopedRows={scoped} />}
    </div>
  );
}

/* ─── Breakdowns: one agent per row, full consolidated columns ─── */
function BreakdownsView({ rows }: { rows: Reconciliation[] }) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          r.agentName.toLowerCase().includes(query.toLowerCase()) ||
          r.agentId.toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agent by name or ID…"
          className="h-9 max-w-xs bg-card text-[13px]"
        />
        <ExportButton
          filename="reconciliation-breakdowns"
          label="Export All Breakdowns"
          data={{
            columns: ["Agent", "ID", "Module", "Period", "Opening", "Insurance", "ZINARA", "Deposits", "Adjustments", "Closing", "Status"],
            rows: filtered.map((r) => [r.agentName, r.agentId, moduleName(r.module), r.period, r.openingPosition, r.insurance, r.zinara, r.deposits, r.adjustments, r.closingPosition, r.status]),
          }}
        />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-4 py-2.5">Module</th>
                  <th className="px-4 py-2.5 text-right">Opening</th>
                  <th className="px-4 py-2.5 text-right">Insurance</th>
                  <th className="px-4 py-2.5 text-right">ZINARA</th>
                  <th className="px-4 py-2.5 text-right">Deposits</th>
                  <th className="px-4 py-2.5 text-right">Adjustments</th>
                  <th className="px-4 py-2.5 text-right">Closing Position</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <Link href={`/app/reconciliation/${r.id}`} className="flex items-center gap-2.5">
                        <AgentAvatar name={r.agentName} size="xs" />
                        <span>
                          <span className="block text-[13px] font-medium">{r.agentName}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{r.agentId}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{moduleName(r.module)}</td>
                    <td className="tnum px-4 py-3 text-right">{r.openingPosition.toLocaleString()}</td>
                    <td className="tnum px-4 py-3 text-right">{r.insurance.toLocaleString()}</td>
                    <td className="tnum px-4 py-3 text-right">{r.zinara.toLocaleString()}</td>
                    <td className="tnum px-4 py-3 text-right">{r.deposits.toLocaleString()}</td>
                    <td className="tnum px-4 py-3 text-right">{r.adjustments.toLocaleString()}</td>
                    <td className="tnum px-4 py-3 text-right font-semibold">
                      <MoneyValue amount={r.closingPosition} currency={r.currency} />
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <ExportButton
                        filename={`recon-${r.agentId}-${r.period}`}
                        label=""
                        className="h-8"
                        data={{
                          columns: ["Field", "Value"],
                          rows: [
                            ["Agent", r.agentName], ["Agent ID", r.agentId], ["Module", moduleName(r.module)],
                            ["Period", formatPeriod(r.period)], ["Currency", r.currency],
                            ["Opening Position", r.openingPosition], ["Insurance", r.insurance],
                            ["ZINARA", r.zinara], ["Deposits", r.deposits],
                            ["Adjustments", r.adjustments], ["Closing Position", r.closingPosition],
                            ["Status", r.status], ["Version", r.version],
                          ],
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted-foreground">No matching agents.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Transactions: flat ledger for the whole batch ─── */
function TransactionsView({ transactions }: { transactions: Txn[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportButton
          filename="reconciliation-transactions"
          label="Export Transactions"
          data={{
            columns: ["Ref", "Description", "Category", "Amount", "Currency", "Date", "Status"],
            rows: transactions.map((t) => [t.ref, t.title, t.category, t.amount, t.currency, t.date, t.status]),
          }}
        />
      </div>
      <Card className="gap-0 py-0 shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5">Ref</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{t.ref}</td>
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{t.category}</td>
                    <td className="tnum px-4 py-3 text-right font-medium">{formatMoney(t.amount, t.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.date}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted-foreground">No transactions in this batch yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Documents: per-agent consolidated docs, real send ─── */
function DocumentsView({
  documents,
  scopedRows,
}: {
  documents: ReconDocument[];
  scopedRows: Reconciliation[];
}) {
  const [query, setQuery] = React.useState("");
  const [sendTarget, setSendTarget] = React.useState<ReconDocument | null>(null);
  const [sending, setSending] = React.useState(false);

  // If no generated documents yet, derive the list from the reconciliation rows.
  const docs: ReconDocument[] = documents.length
    ? documents
    : scopedRows.map((r) => ({
        id: r.id,
        batchId: "",
        agentId: r.agentId,
        agentName: r.agentName,
        module: r.module,
        period: r.period,
        currency: r.currency,
        openingVariance: r.openingPosition,
        insurance: r.insurance,
        zinara: r.zinara,
        totalExpected: r.insurance + r.zinara,
        deposits: r.deposits,
        adjustments: r.adjustments,
        closingVariance: r.closingPosition,
        closingPosition: r.closingPosition,
        status: r.status,
        createdAt: r.publishedAt ?? "",
      }));

  const filtered = docs.filter(
    (d) =>
      d.agentName.toLowerCase().includes(query.toLowerCase()) ||
      d.agentId.toLowerCase().includes(query.toLowerCase())
  );

  async function sendDoc(d: ReconDocument) {
    setSending(true);
    try {
      const res = await fetch("/api/reconciliation/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: d.batchId || d.id, agentId: d.agentId, channels: ["email", "whatsapp"] }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Sent to ${d.agentName}`, { description: data.delivered?.join(" + ") });
      } else {
        toast.error("Send failed", { description: data.error });
      }
    } catch {
      toast.error("Send failed");
    } finally {
      setSending(false);
      setSendTarget(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agent…"
          className="h-9 max-w-xs bg-card text-[13px]"
        />
        <ExportButton
          filename="reconciliation-documents"
          label="Export Document List"
          data={{
            columns: ["Agent", "ID", "Period", "Expected", "Deposited", "Closing", "Status", "Generated"],
            rows: filtered.map((d) => [d.agentName, d.agentId, d.period, d.totalExpected, d.deposits, d.closingPosition, d.status, d.createdAt]),
          }}
        />
      </div>

      <div className="space-y-2.5">
        {filtered.map((d) => (
          <Card key={d.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
              <AgentAvatar name={d.agentName} size="sm" />
              <div className="min-w-[160px] flex-1">
                <p className="text-[13.5px] font-semibold">{d.agentName}</p>
                <p className="font-mono text-[11.5px] text-muted-foreground">
                  {d.agentId} · {moduleName(d.module)} · {formatPeriod(d.period)}
                </p>
              </div>
              <div className="tnum hidden gap-5 text-[12px] sm:flex">
                <div><span className="text-muted-foreground">Expected</span><p className="font-semibold">{formatMoney(d.totalExpected, d.currency)}</p></div>
                <div><span className="text-muted-foreground">Deposited</span><p className="font-semibold">{formatMoney(d.deposits, d.currency)}</p></div>
                <div><span className="text-muted-foreground">Closing</span><p className={`font-bold ${d.closingPosition < 0 ? "text-destructive" : ""}`}>{formatMoney(d.closingPosition, d.currency)}</p></div>
              </div>
              <StatusBadge status={d.status} />
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]" asChild>
                  <Link href={`/app/reconciliation/${d.id}`}><Eye className="size-3.5" aria-hidden /> View</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-[12px]"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `/api/reconciliation/download?agentId=${encodeURIComponent(d.agentId)}&period=${encodeURIComponent(d.period)}&format=xlsx`;
                    a.download = `reconciliation-${d.agentId}-${d.period}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="size-3.5" aria-hidden /> XLSX
                </Button>
                <Button size="sm" className="h-8 gap-1 text-[12px]" onClick={() => setSendTarget(d)}>
                  <Send className="size-3.5" aria-hidden /> Send
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
            No reconciliation documents yet — process an import first.
          </p>
        )}
      </div>

      <Dialog open={!!sendTarget} onOpenChange={() => setSendTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Send reconciliation document</DialogTitle>
            <DialogDescription>
              {sendTarget?.agentName} ({sendTarget?.agentId}) — {sendTarget ? formatPeriod(sendTarget.period) : ""}.
              The document is sent to this agent only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTarget(null)} disabled={sending}>Cancel</Button>
            <Button disabled={sending} onClick={() => sendTarget && sendDoc(sendTarget)}>
              {sending ? "Sending…" : "Send via Email + WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
