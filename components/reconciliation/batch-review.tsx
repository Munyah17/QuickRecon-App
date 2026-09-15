"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ellipsis,
  Eye,
  BadgeCheck,
  Download,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  CircleCheck,
  CircleX,
  Users,
  Send,
  FileDown,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { MoneyValue } from "@/components/shared/money-value";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExportButton } from "@/components/shared/export-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { Reconciliation } from "@/types";

const STATUS_FILTERS = ["all", "success", "warning", "attention"] as const;

/** Page-header actions — Approve & Publish hits the real API. */
export function BatchActions({ rows }: { rows: Reconciliation[] }) {
  const [approving, setApproving] = React.useState(false);

  async function approve() {
    setApproving(true);
    try {
      const res = await fetch("/api/reconciliation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Batch published", {
        description: `${data.published ?? rows.length} agent reconciliations published — each agent sees only their own document.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish batch");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <ExportButton
        filename="reconciliation-batch"
        rows={rows.length}
        label="Download Report"
        title={`QuickRecon — Batch Reconciliation (${rows[0]?.period ?? ""})`}
        data={{
          columns: ["Agent", "Agent ID", "Module", "Insurance", "ZINARA", "Deposits", "Adjustments", "Closing Position", "Status"],
          rows: rows.map((r) => [r.agentName, r.agentId, moduleName(r.module), r.insurance, r.zinara, r.deposits, r.adjustments, r.closingPosition, r.status]),
        }}
      />
      <ConfirmDialog
        trigger={
          <Button className="h-9 gap-1.5 text-[13px]" disabled={approving}>
            <BadgeCheck className="size-4" aria-hidden /> Approve &amp; Publish
          </Button>
        }
        title="Approve & publish batch?"
        description="Publishing makes each agent's consolidated document visible to that agent only. Published figures are immutable — corrections require a new version."
        confirmLabel="Approve & Publish"
        onConfirm={approve}
      />
    </div>
  );
}

export function BatchReview({ rows }: { rows: Reconciliation[] }) {
  const { module } = useWorkspace();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [editData, setEditData] = React.useState<Record<string, Reconciliation>>({});
  const [editingCell, setEditingCell] = React.useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [sendAgent, setSendAgent] = React.useState<Reconciliation | null>(null);
  const [sending, setSending] = React.useState(false);

  const startEdit = React.useCallback((id: string, key: string, val: number) => {
    setEditingCell({ id, key });
    setEditValue(String(val));
  }, []);

  const saveEdit = React.useCallback(() => {
    if (!editingCell) return;
    const { id, key } = editingCell;
    setEditData((d) => ({
      ...d,
      [id]: {
        ...(d[id] ?? rows.find((r) => r.id === id)!),
        [key]: parseFloat(editValue) || 0,
      },
    }));
    setEditingCell(null);
  }, [editingCell, editValue, rows]);

  // Merge edit overrides into rows
  const mergedRows = React.useMemo(() =>
    rows.map((r) => editData[r.id] ? { ...r, ...editData[r.id] } : r),
    [rows, editData]
  );

  const scoped = React.useMemo(
    () => (module === "all" ? mergedRows : mergedRows.filter((r) => r.module === module)),
    [mergedRows, module]
  );
  const filtered = React.useMemo(
    () =>
      statusFilter === "all" ? scoped : scoped.filter((r) => r.status === statusFilter),
    [scoped, statusFilter]
  );

  const stats = React.useMemo(() => {
    const total = scoped.length;
    const success = scoped.filter((r) => r.status === "success").length;
    const warning = scoped.filter((r) => r.status === "warning").length;
    const attention = scoped.filter((r) => r.status === "attention").length;
    return { total, success, warning, attention };
  }, [scoped]);

  const fin = React.useMemo(() => {
    const sum = (k: keyof Reconciliation) =>
      scoped.reduce((s, r) => s + (r[k] as number), 0);
    return {
      insurance: sum("insurance"),
      zinara: sum("zinara"),
      deposits: sum("deposits"),
      adjustments: sum("adjustments"),
      closing: sum("closingPosition"),
      currency: (scoped[0]?.currency ?? "ZWG") as Reconciliation["currency"],
    };
  }, [scoped]);

  const modules = React.useMemo(() => {
    const byModule = new Map<string, { agents: number; insurance: number; deposits: number }>();
    for (const r of scoped) {
      const m = byModule.get(r.module) ?? { agents: 0, insurance: 0, deposits: 0 };
      m.agents += 1;
      m.insurance += r.insurance;
      m.deposits += r.deposits;
      byModule.set(r.module, m);
    }
    return [...byModule.entries()];
  }, [scoped]);

  const [distributing, setDistributing] = React.useState(false);

  async function distributeAll() {
    const targets = scoped.filter((r) => r.status === "success" || r.status === "warning");
    if (targets.length === 0) {
      toast.error("Nothing to send", { description: "No successful reconciliations in scope." });
      return;
    }
    setDistributing(true);
    let ok = 0;
    let failed = 0;
    for (const r of targets) {
      try {
        const res = await fetch("/api/reconciliation/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: r.id, agentId: r.agentId, channels: ["email", "whatsapp"] }),
        });
        const data = await res.json();
        if (data.success) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setDistributing(false);
    toast.success(`Distribution complete — ${ok} sent${failed ? `, ${failed} failed` : ""}`);
  }

  const columns = React.useMemo<ColumnDef<Reconciliation, unknown>[]>(
    () => [
      {
        id: "select",
        header: () => <Checkbox aria-label="Select all" />,
        cell: ({ row }) => <Checkbox aria-label={`Select ${row.original.agentName}`} />,
        size: 30,
        enableSorting: false,
      },
      {
        accessorKey: "agentName",
        header: "Agent Name",
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <AgentAvatar name={row.original.agentName} size="xs" />
            <span className="font-medium">{row.original.agentName}</span>
          </span>
        ),
      },
      {
        accessorKey: "agentId",
        header: "Agent ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-[12px] text-muted-foreground">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ getValue }) => moduleName(getValue() as string),
      },
      {
        accessorKey: "insurance",
        header: "Insurance (ZiG)",
        cell: ({ row }) => (
          <EditableCell
            id={row.original.id}
            value={row.original.insurance}
            field="insurance"
            editing={editingCell}
            editValue={editValue}
            onStartEdit={startEdit}
            onSave={saveEdit}
            onCancel={() => setEditingCell(null)}
            onValueChange={setEditValue}
          />
        ),
      },
      {
        accessorKey: "zinara",
        header: "ZINARA (ZiG)",
        cell: ({ row }) => (
          <EditableCell
            id={row.original.id}
            value={row.original.zinara}
            field="zinara"
            editing={editingCell}
            editValue={editValue}
            onStartEdit={startEdit}
            onSave={saveEdit}
            onCancel={() => setEditingCell(null)}
            onValueChange={setEditValue}
          />
        ),
      },
      {
        accessorKey: "deposits",
        header: "Deposits (ZiG)",
        cell: ({ row }) => (
          <EditableCell
            id={row.original.id}
            value={row.original.deposits}
            field="deposits"
            editing={editingCell}
            editValue={editValue}
            onStartEdit={startEdit}
            onSave={saveEdit}
            onCancel={() => setEditingCell(null)}
            onValueChange={setEditValue}
          />
        ),
      },
      {
        accessorKey: "closingPosition",
        header: "Closing Position",
        cell: ({ row }) => (
          <span className="tnum block text-right">
            <MoneyValue amount={row.original.closingPosition} currency={row.original.currency} />
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/app/reconciliation/${row.original.id}`} className="gap-2">
                  <Eye className="size-4" aria-hidden /> View detail
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/reconciliation/exceptions" className="gap-2">
                  <TriangleAlert className="size-4" aria-hidden /> Resolve exception
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => toast.success("Agent reconciliation queued for reprocessing")}>
                <RotateCcw className="size-4" aria-hidden /> Reprocess
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => toast.success("Report generated", { description: `PDF + CSV for ${row.original.agentName} (${row.original.agentId})` })}>
                <FileDown className="size-4" aria-hidden /> Generate Report
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => setSendAgent(row.original)}>
                <Send className="size-4" aria-hidden /> Send to Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 40,
      },
    ],
    [editValue, editingCell, saveEdit, startEdit]
  );

  return (
    <div className="space-y-4">
      {/* Batch stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={Users} tone="primary" label="Total Agents" value={stats.total} />
        <StatTile icon={CircleCheck} tone="success" label="Successfully Reconciled" value={stats.success} />
        <StatTile icon={TriangleAlert} tone="warning" label="With Warnings" value={stats.warning} />
        <StatTile icon={CircleX} tone="danger" label="Require Attention" value={stats.attention} />
      </div>

      {/* Batch financial summary + module split + health */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[13.5px] font-semibold">Batch Financial Summary</p>
            <div className="mt-3 space-y-2 text-[12.5px]">
              {(
                [
                  ["Total Insurance", fin.insurance],
                  ["Total ZINARA", fin.zinara],
                  ["Total Deposits", fin.deposits],
                  ["Adjustments", fin.adjustments],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <MoneyValue amount={v} currency={fin.currency} className="font-medium" />
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-medium">Net Position</span>
                <MoneyValue
                  amount={fin.closing}
                  currency={fin.currency}
                  className={`font-bold ${fin.closing < 0 ? "text-destructive" : ""}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[13.5px] font-semibold">Module Breakdown</p>
            <div className="mt-3 space-y-2.5">
              {modules.map(([mod, m]) => (
                <div key={mod} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{moduleName(mod)}</span>
                    <span className="text-muted-foreground">{m.agents} agent{m.agents === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
                    <span>
                      Insurance <MoneyValue amount={m.insurance} currency={fin.currency} className="font-semibold text-foreground" />
                    </span>
                    <span>
                      Deposits <MoneyValue amount={m.deposits} currency={fin.currency} className="font-semibold text-foreground" />
                    </span>
                  </div>
                </div>
              ))}
              {modules.length === 0 && (
                <p className="py-4 text-center text-[12.5px] text-muted-foreground">No reconciliations in scope.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[13.5px] font-semibold">Batch Health</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>Reconciled cleanly</span>
                <span className="tnum font-semibold text-foreground">
                  {stats.total ? Math.round((stats.success / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${stats.total ? (stats.success / stats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Warnings</span><span className="tnum font-medium">{stats.warning}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Needs attention</span><span className="tnum font-medium text-warning-foreground">{stats.attention}</span></div>
                <Link href="/app/reconciliation/exceptions" className="inline-flex items-center gap-1 pt-0.5 font-medium text-primary hover:underline">
                  Open Exception Centre <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="hidden items-center gap-2 lg:flex">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 bg-card text-[12.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All Statuses" : s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile segmented filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto lg:hidden">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? "h-8 shrink-0 rounded-full bg-primary px-3 text-[12px] font-semibold text-primary-foreground"
                  : "h-8 shrink-0 rounded-full border bg-card px-3 text-[12px] font-medium text-muted-foreground"
              }
            >
              {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            filename="reconciliation-batch"
            rows={filtered.length}
            label="Export"
            title={`QuickRecon — Batch Reconciliation (${filtered[0]?.period ?? ""})`}
            data={{
              columns: ["Agent", "Agent ID", "Module", "Insurance", "ZINARA", "Deposits", "Adjustments", "Closing Position", "Status"],
              rows: filtered.map((r) => [
                r.agentName,
                r.agentId,
                moduleName(r.module),
                r.insurance,
                r.zinara,
                r.deposits,
                r.adjustments,
                r.closingPosition,
                r.status,
              ]),
            }}
          />
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="h-9 gap-1.5 text-[13px]" disabled={distributing}>
                <Send className="size-4" aria-hidden /> {distributing ? "Sending…" : "Distribute All"}
              </Button>
            }
            title="Distribute reports to all agents?"
            description={`Each of the ${stats.success + stats.warning} successful agents will receive their own reconciliation document via email and WhatsApp.`}
            confirmLabel="Distribute All"
            onConfirm={distributeAll}
          />
          <ConfirmDialog
            trigger={
              <Button className="h-9 gap-1.5 text-[13px]">
                <ShieldCheck className="size-4" aria-hidden /> Approve &amp; Publish
              </Button>
            }
            title="Approve & publish this batch?"
            description="All successful agent reconciliations for this period will be versioned, published to agents and distributed per your report settings. This action is audited."
            confirmLabel="Approve & Publish"
            onConfirm={() =>
              toast.success("Batch published", {
                description: `${stats.success} reconciliations published and notifications queued.`,
              })
            }
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search agents…"
        searchKeys={["agentName", "agentId"]}
        pageSize={10}
        initialSorting={[{ id: "status", desc: true }]}
        renderMobileCard={(r) => <ReconMobileCard r={r} />}
      />

      {sendAgent && (
        <SendToAgentDialog
          agent={sendAgent}
          sending={sending}
          onClose={() => { setSendAgent(null); setSending(false); }}
          onSend={async (channels) => {
            setSending(true);
            try {
              const res = await fetch("/api/reconciliation/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  batchId: sendAgent.id,
                  agentId: sendAgent.agentId,
                  channels,
                }),
              });
              const data = await res.json();
              if (data.success) {
                toast.success("Report sent to agent", {
                  description: `${sendAgent.agentName} (${sendAgent.agentId}) — ${data.delivered.join(" + ") || "queued"}`,
                });
              } else {
                toast.error("Send failed", { description: data.error || data.failures?.join(", ") });
              }
            } catch {
              toast.error("Send failed");
            } finally {
              setSending(false);
              setSendAgent(null);
            }
          }}
        />
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "danger";
  label: string;
  value: number;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-destructive-soft text-destructive",
  } as const;
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div>
          <p className="text-[11.5px] text-muted-foreground">{label}</p>
          <p className="tnum text-[18px] font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReconMobileCard({ r }: { r: Reconciliation }) {
  return (
    <Link href={`/app/reconciliation/${r.id}`} className="block">
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex items-center gap-3">
          <AgentAvatar name={r.agentName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold">{r.agentName}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {r.agentId} · {moduleName(r.module)}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>
        <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <div>
            Ins <p className="text-[12px] font-semibold text-foreground">
              {r.insurance.toLocaleString()}
            </p>
          </div>
          <div>
            ZIN <p className="text-[12px] font-semibold text-foreground">
              {r.zinara.toLocaleString()}
            </p>
          </div>
          <div>
            Closing <p className="text-[12px] font-bold">
              <MoneyValue amount={r.closingPosition} currency={r.currency} />
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EditableCell({
  id,
  value,
  field,
  editing,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onValueChange,
}: {
  id: string;
  value: number;
  field: string;
  editing: { id: string; key: string } | null;
  editValue: string;
  onStartEdit: (id: string, key: string, val: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onValueChange: (v: string) => void;
}) {
  const active = editing && editing.id === id && editing.key === field;
  if (active) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Input
          autoFocus
          type="number"
          value={editValue}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={onSave}
          className="h-7 w-28 bg-card text-right text-[13px]"
        />
      </div>
    );
  }
  return (
    <button
      onClick={() => onStartEdit(id, field, value)}
      className="group tnum block w-full text-right text-[13px] hover:text-primary"
      title="Click to edit"
    >
      {value.toLocaleString()}
      <Pencil className="ml-1.5 inline size-3 opacity-0 group-hover:opacity-50" aria-hidden />
    </button>
  );
}

function SendToAgentDialog({
  agent,
  sending,
  onClose,
  onSend,
}: {
  agent: Reconciliation;
  sending: boolean;
  onClose: () => void;
  onSend: (channels: ("email" | "whatsapp" | "sms")[]) => Promise<void>;
}) {
  const [channels, setChannels] = React.useState<("email" | "whatsapp" | "sms")[]>(["email", "whatsapp"]);

  const toggleChannel = (c: "email" | "whatsapp" | "sms") =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Send Report to {agent.agentName}</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Deliver the individual reconciliation report (PDF + CSV) to {agent.agentId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl border p-3 text-[12.5px]">
            <p className="font-medium">{agent.agentName}</p>
            <p className="text-muted-foreground">{agent.agentId} · {moduleName(agent.module)}</p>
            <p className="mt-1 text-muted-foreground">Period: {agent.period}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[12.5px]">Delivery Channels</Label>
            <label className="flex items-center gap-2.5 text-[13px]">
              <Checkbox checked={channels.includes("email")} onCheckedChange={() => toggleChannel("email")} />
              <Mail className="size-4 text-muted-foreground" aria-hidden /> Email
            </label>
            <label className="flex items-center gap-2.5 text-[13px]">
              <Checkbox checked={channels.includes("whatsapp")} onCheckedChange={() => toggleChannel("whatsapp")} />
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden /> WhatsApp
            </label>
            <label className="flex items-center gap-2.5 text-[13px]">
              <Checkbox checked={channels.includes("sms")} onCheckedChange={() => toggleChannel("sms")} />
              <Phone className="size-4 text-muted-foreground" aria-hidden /> SMS
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            disabled={channels.length === 0 || sending}
            onClick={() => onSend(channels)}
            className="gap-1.5"
          >
            {sending ? (
              <>
                <RotateCcw className="size-4 animate-spin" aria-hidden /> Sending…
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden /> Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
