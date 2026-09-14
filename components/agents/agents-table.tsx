"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis, Eye, ShieldOff, UserPen } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
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
import type { Agent } from "@/types";

const STATUS_TABS = ["all", "active", "suspended", "inactive", "pending"] as const;

export function AgentsTable({ agents }: { agents: Agent[] }) {
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [provinceFilter, setProvinceFilter] = React.useState("all");

  const provinces = React.useMemo(
    () => Array.from(new Set(agents.map((a) => a.province))).sort(),
    [agents]
  );

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
    []
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: agents.length };
    for (const s of STATUS_TABS.slice(1)) {
      c[s] = agents.filter((a) => a.status === s).length;
    }
    return c;
  }, [agents]);

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
        toolbar={
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
            <ExportButton filename={`agents-${Date.now()}`} rows={filtered.length} label="Export" />
          </div>
        }
        renderMobileCard={(a) => <AgentMobileCard agent={a} />}
      />
    </div>
  );
}

function AgentActions({ id, agent }: { id: string; agent: Agent }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);

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
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={() => setSuspendOpen(true)}
          >
            <ShieldOff className="size-4" aria-hidden /> Suspend
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
            <Button
              variant="destructive"
              onClick={() => {
                toast.success(`${agent.fullName} has been suspended`);
                setSuspendOpen(false);
              }}
            >
              Suspend Agent
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

  const handleSave = () => {
    toast.success(`Agent ${fullName} updated successfully`);
    onOpenChange(false);
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Card layout used below lg — mirrors the mobile admin agent list. */
function AgentMobileCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/app/agents/${agent.id}`} className="block">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
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
