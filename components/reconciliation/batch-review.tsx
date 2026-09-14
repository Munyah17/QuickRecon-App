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
import { Card, CardContent } from "@/components/ui/card";
import { moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { Reconciliation } from "@/types";

const STATUS_FILTERS = ["all", "success", "warning", "attention"] as const;

export function BatchReview({ rows }: { rows: Reconciliation[] }) {
  const { module } = useWorkspace();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const scoped = React.useMemo(
    () => (module === "all" ? rows : rows.filter((r) => r.module === module)),
    [rows, module]
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
          <span className="tnum block text-right">
            {(row.original.insurance as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "zinara",
        header: "ZINARA (ZiG)",
        cell: ({ row }) => (
          <span className="tnum block text-right">
            {(row.original.zinara as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "deposits",
        header: "Deposits (ZiG)",
        cell: ({ row }) => (
          <span className="tnum block text-right">
            {(row.original.deposits as number).toLocaleString()}
          </span>
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
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[13px]"
            onClick={() => toast.success("Report exported", { description: `${filtered.length} reconciliation records exported as XLSX` })}
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden sm:inline">Download Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
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
