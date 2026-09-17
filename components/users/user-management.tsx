"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
            <span className="flex flex-col">
              <span className="font-medium">{row.original.fullName}</span>
              {row.original.nationalId && (
                <span className="tnum text-[11px] text-muted-foreground">{row.original.nationalId}</span>
              )}
            </span>
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
                <p className="truncate text-[12px] text-muted-foreground">
                  {u.email}{u.nationalId ? ` · ${u.nationalId}` : ""}
                </p>
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
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [permsOpen, setPermsOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Edit dialog fields
  const [editName, setEditName] = React.useState(user.fullName);
  const [editEmail, setEditEmail] = React.useState(user.email);
  const [editNationalId, setEditNationalId] = React.useState(user.nationalId ?? "");
  const [editRole, setEditRole] = React.useState<RoleCode>(user.role);
  // Permissions dialog role
  const [permRole, setPermRole] = React.useState<RoleCode>(user.role);

  async function patch(body: Record<string, unknown>, successMsg: string, close: () => void) {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success(successMsg);
      close();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const suspended = user.status === "suspended";

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
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>Reset Password</DropdownMenuItem>
          <DropdownMenuItem
            className={suspended ? "" : "text-destructive focus:text-destructive"}
            onSelect={() => setSuspendOpen(true)}
          >
            {suspended ? "Reactivate" : "Suspend"}
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
              <Input id="edit-user-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input id="edit-user-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-id">National ID / Passport</Label>
              <Input id="edit-user-id" value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-user-role">Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as RoleCode)}>
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
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={() =>
                patch(
                  { fullName: editName, email: editEmail, nationalId: editNationalId, role: editRole },
                  `User ${editName} updated`,
                  () => setEditOpen(false)
                )
              }
            >
              {saving ? "Saving…" : "Save Changes"}
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
              <Select value={permRole} onValueChange={(v) => setPermRole(v as RoleCode)}>
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
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                {permRole === user.role ? "Current" : "New"} Permissions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {permissionsForRole(permRole).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10.5px]">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermsOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              disabled={saving || permRole === user.role}
              onClick={() =>
                patch(
                  { role: permRole },
                  `Permissions updated for ${user.fullName}`,
                  () => setPermsOpen(false)
                )
              }
            >
              {saving ? "Updating…" : "Update Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog user={user} open={resetOpen} onOpenChange={setResetOpen} />

      {/* Suspend / Reactivate Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{suspended ? "Reactivate User?" : "Suspend User?"}</DialogTitle>
            <DialogDescription>
              {suspended
                ? `${user.fullName} will regain access immediately.`
                : `${user.fullName} will lose access immediately. This action is audit-logged.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant={suspended ? "default" : "destructive"}
              disabled={saving}
              onClick={() =>
                patch(
                  { status: suspended ? "active" : "suspended" },
                  suspended ? `${user.fullName} reactivated` : `${user.fullName} suspended`,
                  () => setSuspendOpen(false)
                )
              }
            >
              {saving ? "Updating…" : suspended ? "Reactivate User" : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: TeamUser;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function reset() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      toast.success(`Password updated for ${user.fullName}`);
      onOpenChange(false);
      setPassword(""); setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.fullName} ({user.email}). This action is audit-logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-pw">New Password</Label>
            <Input id="reset-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-pw2">Confirm Password</Label>
            <Input id="reset-pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={reset} disabled={saving}>
            {saving ? "Updating…" : "Set New Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [nationalId, setNationalId] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [role, setRole] = React.useState<RoleCode>("agent");
  const [moduleAccess, setModuleAccess] = React.useState<string>("both");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const reset = () => {
    setFullName(""); setEmail(""); setPhone(""); setNationalId("");
    setLocation(""); setRole("agent"); setModuleAccess("both");
    setPassword(""); setConfirmPassword("");
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName, email, phone, nationalId, location, role, moduleAccess, password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      toast.success(`User ${fullName} created`, {
        description: `${roleLabel(role)} account is ${data.status ?? "active"}.`,
      });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" aria-hidden /> Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
          <DialogDescription>
            Create an account with the details below. Login credentials are sent to their email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="add-user-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input id="add-user-name" placeholder="e.g. John Smith" value={fullName}
              onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input id="add-user-email" type="email" placeholder="user@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-phone">Phone</Label>
            <Input id="add-user-phone" placeholder="+263 7X XXX XXXX" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-id">National ID / Passport</Label>
            <Input id="add-user-id" placeholder="XX-XXXXXXX-X-XX" value={nationalId}
              onChange={(e) => setNationalId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-location">Location / Province</Label>
            <Input id="add-user-location" placeholder="e.g. Harare" value={location}
              onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleCode)}>
              <SelectTrigger id="add-user-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_BADGE) as RoleCode[]).map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-module">Module Access</Label>
            <Select value={moduleAccess} onValueChange={setModuleAccess}>
              <SelectTrigger id="add-user-module"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both modules</SelectItem>
                <SelectItem value="enpassent">Enpassent only</SelectItem>
                <SelectItem value="econet-moovah">Econet Moovah only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input id="add-user-password" type="password" placeholder="Min. 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-user-confirm">
              Confirm Password <span className="text-destructive">*</span>
            </Label>
            <Input id="add-user-confirm" type="password" placeholder="Repeat password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
