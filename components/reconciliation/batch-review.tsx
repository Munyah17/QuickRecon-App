"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Ellipsis,
  Eye,
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

export function BatchReview({ rows }: { rows: Reconciliation[] }) {
  const { module } = useWorkspace();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [editData, setEditData] = React.useState<Record<string, Reconciliation>>({});
  const [editingCell, setEditingCell] = React.useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [sendAgent, setSendAgent] = React.useState<Reconciliation | null>(null);
  const [sending, setSending] = React.useState(false);

  const startEdit = (id: string, key: string, val: number) => {
    setEditingCell({ id, key });
    setEditValue(String(val));
  };

  const saveEdit = () => {
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
  };

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
    []
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

        <div className="flex items-center gap-2">
          <ExportButton
            filename={`reconciliation-${Date.now()}`}
            rows={filtered.length}
            label="Export"
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
            // Simulate API call for sending report
            await new Promise((r) => setTimeout(r, 1500));
            const channelLabels = channels.map((c) => c === "email" ? "Email" : "WhatsApp").join(" + ");
            toast.success("Report sent to agent", {
              description: `${sendAgent.agentName} (${sendAgent.agentId}) — PDF + CSV via ${channelLabels}`,
            });
            setSending(false);
            setSendAgent(null);
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
  onSend: (channels: ("email" | "whatsapp")[]) => Promise<void>;
}) {
  const [channels, setChannels] = React.useState<("email" | "whatsapp")[]>(["email", "whatsapp"]);

  const toggleChannel = (c: "email" | "whatsapp") =>
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
