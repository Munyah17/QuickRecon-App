"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ellipsis, Plus, UserRoundPlus, Search, Users, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { DataTable } from "@/components/data-table/data-table";
import { ExportButton } from "@/components/shared/export-button";
import type { Assistant, Booth } from "@/types";

const requestSchema = z.object({
  fullName: z.string().min(3, "Enter the assistant's full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(9, "Enter a valid phone number"),
  boothId: z.string().min(1, "Assign a booth"),
});
type RequestValues = z.infer<typeof requestSchema>;

const PERMISSION_OPTIONS = [
  { id: "submissions", label: "Create submissions" },
  { id: "reports", label: "View booth reports" },
  { id: "transactions", label: "Record transactions" },
];

/**
 * Agent "My Assistants" — add-request dialog (goes to Super Admin approval)
 * plus the current roster with statuses.
 */
export function MyAssistants({
  assistants,
  booths,
  isAdminView = false,
}: {
  assistants: (Assistant & { parentAgentName?: string })[];
  booths: Booth[];
  isAdminView?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [perms, setPerms] = React.useState<string[]>(["submissions"]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [boothFilter, setBoothFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    return assistants.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesBooth = boothFilter === "all" || a.boothId === boothFilter;
      return matchesSearch && matchesStatus && matchesBooth;
    });
  }, [assistants, search, statusFilter, boothFilter]);

  const stats = React.useMemo(() => {
    return {
      total: assistants.length,
      active: assistants.filter((a) => a.status === "active").length,
      pending: assistants.filter((a) => a.status === "pending").length,
      suspended: assistants.filter((a) => a.status === "suspended").length,
    };
  }, [assistants]);

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { fullName: "", email: "", phone: "", boothId: "" },
  });

  function togglePerm(id: string, on: boolean) {
    setPerms((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  }

  async function onSubmit(values: RequestValues) {
    console.info("assistant request", { ...values, perms });
    toast.success("Assistant request submitted", {
      description: "A Super Admin will review and approve the account before it activates.",
    });
    setOpen(false);
    form.reset();
    setPerms(["submissions"]);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Users} label="Total Assistants" value={stats.total} />
        <StatCard icon={ShieldCheck} tone="success" label="Active" value={stats.active} />
        <StatCard icon={Search} tone="warning" label="Pending" value={stats.pending} />
        <StatCard icon={AlertCircle} tone="danger" label="Suspended" value={stats.suspended} />
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search by name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card pl-9 text-[13px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 bg-card text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={boothFilter} onValueChange={setBoothFilter}>
          <SelectTrigger className="h-9 w-40 bg-card text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Booths</SelectItem>
            {booths.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportButton filename={`assistants-${Date.now()}`} rows={filtered.length} label="Export" />
      </div>

      {!isAdminView && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto">
              <UserRoundPlus className="size-4" aria-hidden /> Add Assistant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request New Assistant</DialogTitle>
              <DialogDescription>
                The account activates only after Super Admin approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" placeholder="e.g. Tairo Moyo" {...form.register("fullName")} />
                {form.formState.errors.fullName && (
                  <p className="text-[12px] text-destructive">{form.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@example.com" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-[12px] text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+263 77 000 0000" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-[12px] text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Booth assignment</Label>
                <Select onValueChange={(v) => form.setValue("boothId", v, { shouldValidate: true })}>
                  <SelectTrigger aria-label="Booth assignment">
                    <SelectValue placeholder="Select a booth" />
                  </SelectTrigger>
                  <SelectContent>
                    {booths.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — {b.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.boothId && (
                  <p className="text-[12px] text-destructive">{form.formState.errors.boothId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Requested permissions</Label>
                {PERMISSION_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 text-[13px]">
                    <Checkbox
                      checked={perms.includes(p.id)}
                      onCheckedChange={(c) => togglePerm(p.id, c === true)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                Submit for approval
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="py-0 shadow-xs">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Plus className="size-5" aria-hidden />
              </span>
              <p className="text-[13.5px] font-semibold">No assistants found</p>
              <p className="text-[12px] text-muted-foreground">
                {isAdminView ? "No assistant accounts match your filters." : "Request an assistant to delegate booth work."}
              </p>
            </CardContent>
          </Card>
        )}
        {filtered.map((a) => (
          <Card key={a.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <AgentAvatar name={a.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-semibold">{a.fullName}</p>
                  <StatusBadge status={a.status} />
                </div>
                <p className="truncate text-[12px] text-muted-foreground">{a.email}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {a.boothName ?? "Unassigned"}
                  {isAdminView && a.parentAgentName ? ` · Agent: ${a.parentAgentName}` : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Assistant actions">
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => toast.info(`Viewing profile for ${a.fullName}`)}>
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast.info(`Editing permissions for ${a.fullName}`)}>
                    Edit permissions
                  </DropdownMenuItem>
                  {isAdminView && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => toast.success(`${a.fullName} has been removed`)}
                    >
                      Remove assistant
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-destructive-soft text-destructive",
  };
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone ? toneClasses[tone] : toneClasses.default}`}>
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
