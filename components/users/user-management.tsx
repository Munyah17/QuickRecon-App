"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Ellipsis, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, permissionsForRole, roleLabel } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import type { PendingApproval, RoleCode, TeamUser } from "@/types";

const ROLE_BADGE: Record<RoleCode, string> = {
  super_admin: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  agent: "bg-success-soft text-success-foreground",
  assistant: "bg-warning-soft text-warning-foreground",
  tech_support: "bg-muted text-muted-foreground",
};

const SEGMENTS = ["all", "active", "pending", "suspended"] as const;

export function UserManagement({
  users,
  pendingApprovals,
}: {
  users: TeamUser[];
  pendingApprovals: PendingApproval[];
}) {
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filtered = React.useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (statusFilter !== "all" && u.status !== statusFilter) return false;
        return true;
      }),
    [users, roleFilter, statusFilter]
  );

  const columns = React.useMemo<ColumnDef<TeamUser, unknown>[]>(
    () => [
      {
        id: "idx",
        header: "#",
        cell: ({ row }) => <span className="tnum text-muted-foreground">{row.index + 1}</span>,
        size: 32,
      },
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <AgentAvatar name={row.original.fullName} size="sm" />
            <span className="font-medium">{row.original.fullName}</span>
          </span>
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
        accessorKey: "role",
        header: "Role",
        cell: ({ getValue }) => {
          const role = getValue() as RoleCode;
          return (
            <Badge variant="outline" className={`border-transparent text-[11px] font-medium ${ROLE_BADGE[role]}`}>
              {roleLabel(role)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last Login",
        cell: ({ getValue }) => {
          const v = getValue() as string | undefined;
          return (
            <span className="tnum text-muted-foreground">
              {v ? formatDate(v, "dd MMM yyyy, HH:mm") : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <UserActions user={row.original} />
        ),
      },
    ],
    []
  );

  return (
    <Tabs defaultValue="users">
      <TabsList variant="line" className="w-full justify-start gap-5 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="users" className="rounded-none px-1 pb-2.5 text-[13px]">Users</TabsTrigger>
        <TabsTrigger value="roles" className="rounded-none px-1 pb-2.5 text-[13px]">Roles & Permissions</TabsTrigger>
        <TabsTrigger value="approvals" className="rounded-none px-1 pb-2.5 text-[13px]">
          Pending Approvals
          {pendingApprovals.length > 0 && (
            <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {pendingApprovals.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="mt-4 space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto lg:hidden">
          {SEGMENTS.map((s) => {
            const count = s === "all" ? users.length : users.filter((u) => u.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={
                  statusFilter === s
                    ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                    : "h-8 shrink-0 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
                }
              >
                {s === "all" ? `All (${count})` : `${s[0].toUpperCase() + s.slice(1)} (${count})`}
              </button>
            );
          })}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search users by name, email or role"
          searchKeys={["fullName", "email", "role"]}
          toolbar={
            <div className="hidden items-center gap-2 lg:flex">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-32 bg-card text-[12.5px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {(Object.keys(ROLE_BADGE) as RoleCode[]).map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 bg-card text-[12.5px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All Statuses" : s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          renderMobileCard={(u) => (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
              <AgentAvatar name={u.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{u.fullName}</p>
                <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
              </div>
              <Badge variant="outline" className={`border-transparent text-[11px] ${ROLE_BADGE[u.role]}`}>
                {roleLabel(u.role)}
              </Badge>
            </div>
          )}
        />

        <div className="mt-4 hidden justify-end lg:flex">
          <AddUserDialog />
        </div>
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(ROLE_BADGE) as RoleCode[]).map((role) => {
            const perms = permissionsForRole(role);
            return (
              <Card key={role} className="gap-0 py-0 shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`border-transparent text-[11.5px] font-semibold ${ROLE_BADGE[role]}`}>
                      {roleLabel(role)}
                    </Badge>
                    <span className="tnum text-[11.5px] text-muted-foreground">
                      {perms.length} permissions
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                    {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[])
                      .filter((group) => PERMISSIONS[group].some((p) => (perms as string[]).includes(p)))
                      .map((g) => (g === "reconciliation" ? "Reconciliation" : g[0].toUpperCase() + g.slice(1)))
                      .join(" · ")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 w-full gap-1.5 text-[12px]"
                    onClick={() => toast.info(`Configure ${roleLabel(role)} permissions`)}
                  >
                    <ShieldCheck className="size-3.5" aria-hidden /> Configure
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="approvals" className="mt-4 space-y-3">
        {pendingApprovals.length === 0 && (
          <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
            No pending approvals.
          </p>
        )}
        {pendingApprovals.map((a) => (
          <Card key={a.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <AgentAvatar name={a.name} size="md" />
              <div className="min-w-[160px] flex-1">
                <p className="text-[13.5px] font-semibold">{a.name}</p>
                <p className="text-[12px] text-muted-foreground">{a.detail}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Requested by {a.requestedBy} · {formatDate(a.requestedAt, "dd MMM yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ConfirmDialog
                  trigger={
                    <Button size="sm" className="h-8 gap-1.5 text-[12px]">
                      <Check className="size-3.5" aria-hidden /> Approve
                    </Button>
                  }
                  title="Approve request?"
                  description={`Approving activates ${a.detail}. An audit entry will be recorded.`}
                  confirmLabel="Approve"
                  onConfirm={() => toast.success(`Approved: ${a.detail}`)}
                />
                <Button size="sm" variant="outline" className="h-8 text-[12px]"
                  onClick={() => toast.info(`Changes requested for ${a.name}`)}
                >
                  Request changes
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-[12px] text-destructive">
                      <X className="size-3.5" aria-hidden /> Reject
                    </Button>
                  }
                  title="Reject request?"
                  description="The requester will be notified. This is audit-logged."
                  confirmLabel="Reject"
                  destructive
                  onConfirm={() => toast.success(`Rejected: ${a.detail}`)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function UserActions({ user }: { user: TeamUser }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [permsOpen, setPermsOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="User actions">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPermsOpen(true)}>Manage Permissions</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast.info(`Activity log for ${user.fullName}`)}>View Activity</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>Reset Password</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setSuspendOpen(true)}
          >
            Suspend
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details for {user.fullName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-name">Full Name</Label>
              <Input id="edit-user-name" defaultValue={user.fullName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input id="edit-user-email" type="email" defaultValue={user.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-role">Role</Label>
              <Select defaultValue={user.role}>
                <SelectTrigger id="edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_BADGE) as RoleCode[]).map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success(`User ${user.fullName} updated`); setEditOpen(false); }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={permsOpen} onOpenChange={setPermsOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
            <DialogDescription>Configure permissions for {user.fullName} ({roleLabel(user.role)}).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select defaultValue={user.role}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_BADGE) as RoleCode[]).map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">Current Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {permissionsForRole(user.role).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10.5px]">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermsOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success(`Permissions updated for ${user.fullName}`); setPermsOpen(false); }}>
              Update Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              A password reset link will be sent to {user.email}. This action is audit-logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success(`Reset link sent to ${user.email}`); setResetOpen(false); }}>
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Suspend User?</DialogTitle>
            <DialogDescription>
              {user.fullName} will lose access immediately. This action is audit-logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.success(`${user.fullName} suspended`); setSuspendOpen(false); }}>
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<RoleCode>("agent");

  const handleCreate = () => {
    if (!fullName || !email) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success(`User ${fullName} created successfully`);
    setFullName("");
    setEmail("");
    setRole("agent");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" aria-hidden /> Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. They will receive an email with login instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-user-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-user-name"
              placeholder="e.g. John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-user-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleCode)}>
              <SelectTrigger id="add-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_BADGE) as RoleCode[]).map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
