"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { CircleCheck, Ellipsis, Eye, ShieldOff, Trash2, UserPen } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExportButton } from "@/components/shared/export-button";
import { AGENT_POS_BANKS, type Agent, type AgentPosBank } from "@/types";

const STATUS_TABS = ["all", "active", "suspended", "inactive", "pending"] as const;

export function AgentsTable({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [provinceFilter, setProvinceFilter] = React.useState("all");
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [activating, setActivating] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkAction, setBulkAction] = React.useState<"active" | "suspended" | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const selectedIds = React.useMemo(() => Object.keys(rowSelection), [rowSelection]);

  const provinces = React.useMemo(
    () => Array.from(new Set(agents.map((a) => a.province))).sort(),
    [agents]
  );

  /** Banks that actually have a POS ID on at least one agent — each gets its
   * own column, ordered like AGENT_POS_BANKS. */
  const posBanks = React.useMemo<AgentPosBank[]>(() => {
    const present = new Set<AgentPosBank>();
    for (const a of agents) for (const p of a.bankPos ?? []) present.add(p.bank);
    return AGENT_POS_BANKS.filter((b) => present.has(b));
  }, [agents]);

  const filtered = React.useMemo(
    () =>
      agents.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (provinceFilter !== "all" && a.province !== provinceFilter) return false;
        if (moduleFilter !== "all") {
          const access = a.modules.find((m) => m.module === moduleFilter);
          if (!access?.enabled) return false;
        }
        return true;
      }),
    [agents, moduleFilter, statusFilter, provinceFilter]
  );

  const columns = React.useMemo<ColumnDef<Agent, unknown>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          // Select-all covers every filtered row, not just the current page.
          const all = table.getFilteredRowModel().rows;
          const allSelected = all.length > 0 && all.every((r) => r.getIsSelected());
          const someSelected = all.some((r) => r.getIsSelected());
          return (
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => {
                if (v) {
                  const next: RowSelectionState = {};
                  for (const r of all) next[r.id] = true;
                  table.setRowSelection(next);
                } else {
                  table.resetRowSelection();
                }
              }}
              aria-label="Select all agents"
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={() => row.toggleSelected()}
            aria-label={`Select ${row.original.fullName}`}
          />
        ),
        enableSorting: false,
        size: 36,
      },
      {
        id: "idx",
        header: "#",
        cell: ({ row }) => (
          <span className="tnum text-muted-foreground">{row.index + 1}</span>
        ),
        size: 32,
      },
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/app/agents/${row.original.id}`}
            className="flex items-center gap-2.5 hover:underline"
          >
            <AgentAvatar name={row.original.fullName} size="sm" />
            <span className="font-medium">{row.original.fullName}</span>
          </Link>
        ),
      },
      {
        accessorKey: "id",
        header: "Agent ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-[12px] text-muted-foreground">
            {getValue() as string}
          </span>
        ),
      },
      // One POS ID column per bank — each bank issues its own POS device
      // whose ID appears on that bank's statement.
      ...posBanks.map(
        (bank): ColumnDef<Agent, unknown> => ({
          id: `pos-${bank.toLowerCase()}`,
          header: `${bank} POS`,
          cell: ({ row }) => {
            const posId = row.original.bankPos?.find((p) => p.bank === bank)?.posId;
            return (
              <span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">
                {posId ?? "—"}
              </span>
            );
          },
        })
      ),
      {
        accessorKey: "modules",
        header: "Modules",
        cell: ({ row }) => (
          <span className="text-[12.5px]">
            {row.original.modules
              .filter((m) => m.enabled)
              .map((m) => (m.module === "econet-moovah" ? "Econet" : "Enpassent"))
              .join(", ") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "boothsCount",
        header: "Booths",
        cell: ({ getValue }) => (
          <span className="tnum">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => (
          <span className="tnum whitespace-nowrap">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue() as string}</span>
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
        cell: ({ row }) => (
          <AgentActions id={row.original.id} agent={row.original} />
        ),
        size: 40,
      },
    ],
    [posBanks]
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: agents.length };
    for (const s of STATUS_TABS.slice(1)) {
      c[s] = agents.filter((a) => a.status === s).length;
    }
    return c;
  }, [agents]);

  /** Apply a status change to the checked agents via the bulk PATCH endpoint. */
  const applyBulkStatus = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: bulkAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success(
        `${data.updated} agent${data.updated === 1 ? "" : "s"} ${
          bulkAction === "active" ? "activated" : "suspended"
        }`
      );
      setBulkAction(null);
      setRowSelection({});
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBulkBusy(false);
    }
  };

  /** Flip every agent still "pending" (e.g. straight after a bulk import)
   * to "active" via the bulk PATCH endpoint. */
  const activatePending = async () => {
    setActivating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStatus: "pending", status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      toast.success(`${data.updated} agent${data.updated === 1 ? "" : "s"} activated`);
      setActivateOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mobile segmented status filter (per mobile mockup) */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? "h-8 shrink-0 rounded-full bg-primary px-3 text-[12px] font-semibold text-primary-foreground"
                  : "h-8 shrink-0 rounded-full border bg-card px-3 text-[12px] font-medium text-muted-foreground"
              }
            >
              {s === "all" ? `All (${counts.all})` : `${s[0].toUpperCase() + s.slice(1)} (${counts[s]})`}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search agents by name, ID, phone or email"
        searchKeys={["fullName", "id", "phone", "email"]}
        pageSize={10}
        initialSorting={[{ id: "fullName", desc: false }]}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(a) => a.id}
        toolbar={
          <>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-muted-foreground">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 text-[12.5px]"
                  onClick={() => setBulkAction("active")}
                >
                  <CircleCheck className="size-4" aria-hidden /> Activate
                </Button>
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 text-[12.5px] text-destructive hover:text-destructive"
                  onClick={() => setBulkAction("suspended")}
                >
                  <ShieldOff className="size-4" aria-hidden /> Suspend
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 text-[12.5px]"
                  onClick={() => setRowSelection({})}
                >
                  Clear
                </Button>
              </div>
            )}
            {counts.pending > 0 && (
              <Button
                variant="outline"
                className="h-9 gap-1.5 text-[12.5px]"
                onClick={() => setActivateOpen(true)}
              >
                <CircleCheck className="size-4" aria-hidden />
                Activate {counts.pending} pending
              </Button>
            )}
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="h-9 w-36 bg-card text-[12.5px]">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="enpassent">Enpassent</SelectItem>
                <SelectItem value="econet-moovah">Econet Moovah</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-32 bg-card text-[12.5px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_TABS.slice(1).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger className="h-9 w-36 bg-card text-[12.5px]">
                <SelectValue placeholder="All Provinces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Provinces</SelectItem>
                {provinces.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              filename="agents-export"
              rows={filtered.length}
              label="Export"
              title="QuickRecon — Agents"
              data={{
                columns: [
                  "#", "Name", "Agent ID",
                  ...posBanks.map((b) => `${b} POS`),
                  "Modules", "Booths", "Phone", "Email", "Status",
                ],
                rows: filtered.map((a, i) => [
                  i + 1,
                  a.fullName,
                  a.id,
                  ...posBanks.map(
                    (b) => a.bankPos?.find((p) => p.bank === b)?.posId ?? "—"
                  ),
                  a.modules.filter((m) => m.enabled).map((m) => (m.module === "econet-moovah" ? "Econet" : "Enpassent")).join(", "),
                  a.boothsCount,
                  a.phone,
                  a.email,
                  a.status,
                ]),
              }}
            />
            </div>
          </>
        }
        renderMobileCard={(a, ctx) => (
          <AgentMobileCard agent={a} selected={ctx.selected} onToggle={ctx.toggleSelected} />
        )}
      />

      {/* Bulk status change for the checked agents. */}
      <Dialog open={bulkAction !== null} onOpenChange={(o) => !o && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "active" ? "Activate" : "Suspend"} {selectedIds.length} selected agent
              {selectedIds.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              {bulkAction === "active"
                ? "Active agents are included in reconciliation runs and statement delivery."
                : "Suspended agents lose access until reactivated. This action is audit-logged."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button
              variant={bulkAction === "suspended" ? "destructive" : "default"}
              onClick={applyBulkStatus}
              disabled={bulkBusy}
            >
              {bulkBusy
                ? "Working…"
                : `${bulkAction === "active" ? "Activate" : "Suspend"} ${selectedIds.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk activate — flips every agent still "pending" to active. */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate pending agents?</DialogTitle>
            <DialogDescription>
              This marks all {counts.pending} agent{counts.pending === 1 ? "" : "s"} currently
              pending as active. Active agents are included in reconciliation
              runs and statement delivery.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={activatePending} disabled={activating}>
              {activating ? "Activating…" : `Activate ${counts.pending}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentActions({ id, agent }: { id: string; agent: Agent }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [suspending, setSuspending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [activating, setActivating] = React.useState(false);

  const activate = async () => {
    setActivating(true);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activate failed");
      toast.success(`${agent.fullName} is now active`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setActivating(false);
    }
  };

  const suspend = async () => {
    setSuspending(true);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suspend failed");
      toast.success(`${agent.fullName} has been suspended`);
      setSuspendOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suspend failed");
    } finally {
      setSuspending(false);
    }
  };

  const deleteAgent = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`${agent.fullName} has been deleted`);
      setDeleteOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Agent actions">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/app/agents/${id}`} className="gap-2">
              <Eye className="size-4" aria-hidden /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onSelect={() => setEditOpen(true)}>
            <UserPen className="size-4" aria-hidden /> Edit agent
          </DropdownMenuItem>
          {agent.status !== "active" && (
            <DropdownMenuItem
              className="gap-2"
              onSelect={activate}
              disabled={activating}
            >
              <CircleCheck className="size-4" aria-hidden />
              {activating ? "Activating…" : "Activate"}
            </DropdownMenuItem>
          )}
          {agent.status !== "suspended" && (
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onSelect={() => setSuspendOpen(true)}
            >
              <ShieldOff className="size-4" aria-hidden /> Suspend
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditAgentDialog agent={agent} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend agent?</DialogTitle>
            <DialogDescription>
              Suspending will revoke access for {agent.fullName}. They will no
              longer be able to log in or perform reconciliations. This action
              is audit-logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={suspend} disabled={suspending}>
              {suspending ? "Suspending…" : "Suspend Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              This will permanently delete {agent.fullName} ({agent.id}) and all their data
              including reconciliations, booths, and module access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAgent} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditAgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: Agent;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [fullName, setFullName] = React.useState(agent.fullName);
  const [email, setEmail] = React.useState(agent.email);
  const [phone, setPhone] = React.useState(agent.phone);
  const [province, setProvince] = React.useState(agent.province);
  const [location, setLocation] = React.useState(agent.location);
  const [posIds, setPosIds] = React.useState<Record<string, string>>(
    Object.fromEntries((agent.bankPos ?? []).map((p) => [p.bank, p.posId]))
  );
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          province,
          location,
          bankPos: AGENT_POS_BANKS.map((bank) => ({
            bank,
            posId: (posIds[bank] ?? "").trim(),
          })).filter((p) => p.posId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success(`Agent ${fullName} updated`);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update agent details for {agent.id}. Changes are audit-logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullname">Full Name</Label>
            <Input
              id="edit-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-province">Province</Label>
              <Input
                id="edit-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bank POS IDs</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Each bank issues its own POS device — the ID below must match
              that bank&apos;s statement.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {AGENT_POS_BANKS.map((bank) => (
                <div key={bank} className="space-y-1">
                  <Label htmlFor={`edit-pos-${bank}`} className="text-[11.5px] text-muted-foreground">
                    {bank}
                  </Label>
                  <Input
                    id={`edit-pos-${bank}`}
                    className="font-mono text-[12.5px]"
                    placeholder={`${bank} POS ID`}
                    value={posIds[bank] ?? ""}
                    onChange={(e) =>
                      setPosIds((s) => ({ ...s, [bank]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Card layout used below lg — mirrors the mobile admin agent list. */
function AgentMobileCard({
  agent,
  selected,
  onToggle,
}: {
  agent: Agent;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <Link href={`/app/agents/${agent.id}`} className="block">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-card p-3.5",
          selected && "border-primary/50 bg-primary/5"
        )}
      >
        {onToggle ? (
          // stopPropagation + preventDefault so the tap never triggers Link nav
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle()}
              aria-label={`Select ${agent.fullName}`}
            />
          </span>
        ) : null}
        <AgentAvatar name={agent.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{agent.fullName}</p>
          <p className="truncate font-mono text-[11.5px] text-muted-foreground">
            {agent.id} · {agent.location}
          </p>
        </div>
        <StatusBadge status={agent.status} />
        <AgentActions id={agent.id} agent={agent} />
      </div>
    </Link>
  );
}
