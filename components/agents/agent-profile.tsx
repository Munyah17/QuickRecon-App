"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ellipsis,
  Eye,
  FileText,
  MapPin,
  Phone,
  Mail,
  IdCard,
  CreditCard,
  CalendarDays,
  KeyRound,
  UserPen,
  Plus,
  Check,
  X,
  Store,
} from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { MoneyValue } from "@/components/shared/money-value";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { isCompanyRole, } from "@/lib/nav";
import { formatDate, moduleName } from "@/lib/format";
import type {
  ActivityItem,
  Agent,
  Assistant,
  Booth,
  Reconciliation,
  AppUser,
} from "@/types";

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      <span className="w-24 shrink-0 text-[12px] text-muted-foreground sm:w-28">
        {label}
      </span>
      <span className={`min-w-0 flex-1 break-all text-[13px] font-medium ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function AgentProfile({
  agent,
  booths,
  assistants,
  reconciliations,
  activities,
  viewer,
}: {
  agent: Agent;
  booths: Booth[];
  assistants: Assistant[];
  reconciliations: Reconciliation[];
  activities: ActivityItem[];
  viewer: AppUser;
}) {
  const canManage = isCompanyRole(viewer.role);
  const [modules, setModules] = React.useState(agent.modules);
  const m = agent.metrics;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/app/agents"
          className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Agents /</span> {agent.fullName}
        </Link>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px]">
              <UserPen className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Edit</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px]">
              <KeyRound className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Reset Password</span>
              <span className="sm:hidden">Reset</span>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Identity card */}
        <Card className="gap-0 py-0 shadow-xs lg:col-span-4 xl:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 lg:flex-col lg:text-center">
              <AgentAvatar name={agent.fullName} size="lg" className="lg:size-20 lg:text-[22px]" />
              <div>
                <h2 className="text-[17px] font-bold tracking-tight">{agent.fullName}</h2>
                <p className="font-mono text-[12px] text-muted-foreground">{agent.id}</p>
                <div className="mt-1.5 flex lg:justify-center">
                  <StatusBadge status={agent.status} />
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Modules
            </p>
            <div className="space-y-2">
              {modules.map((mod) => (
                <div key={mod.module} className="flex items-center justify-between rounded-lg border p-2">
                  <StatusBadge
                    status="active"
                    className={
                      mod.module === "enpassent"
                        ? "bg-success-soft text-success-foreground"
                        : "bg-info-soft text-info-foreground"
                    }
                  />
                  <span className="flex-1 px-2 text-[12.5px] font-medium">
                    {moduleName(mod.module)}
                  </span>
                  {canManage ? (
                    <Switch
                      checked={mod.enabled}
                      aria-label={`Toggle ${moduleName(mod.module)} access`}
                      onCheckedChange={(checked) =>
                        setModules((prev) =>
                          prev.map((x) => (x.module === mod.module ? { ...x, enabled: checked } : x))
                        )
                      }
                    />
                  ) : (
                    <span className={`text-[11.5px] font-medium ${mod.enabled ? "text-success-foreground" : "text-muted-foreground"}`}>
                      {mod.enabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-0.5">
              <InfoRow icon={Phone} label="Phone" value={agent.phone} mono />
              <InfoRow icon={Mail} label="Email" value={agent.email} />
              {agent.nationalId ? (
                <InfoRow icon={IdCard} label="ID/Passport" value={agent.nationalId} mono />
              ) : null}
              {agent.iceCashId ? (
                <InfoRow icon={CreditCard} label="IceCash ID" value={agent.iceCashId} mono />
              ) : null}
              <InfoRow icon={MapPin} label="Location" value={`${agent.location}, ${agent.province}`} />
              <InfoRow icon={CalendarDays} label="Joined" value={formatDate(agent.joinedAt, "dd MMM yyyy")} />
            </div>
          </CardContent>
        </Card>

        {/* Tabbed content */}
        <div className="lg:col-span-8 xl:col-span-9">
          <Tabs defaultValue="overview">
            <TabsList
              variant="line"
              className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0"
            >
              {[
                ["overview", "Overview"],
                ["booths", `Booths (${booths.length})`],
                ["assistants", `Assistants (${assistants.length})`],
                ["documents", "Documents"],
                ["reconciliations", "Reconciliations"],
                ["activity", "Activity"],
              ].map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 rounded-none px-1 pb-2.5 text-[13px]"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {m ? (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    { label: "Total Insurance", amount: m.totalInsurance, danger: false },
                    { label: "Total ZINARA", amount: m.totalZinara, danger: false },
                    { label: "Total Deposits", amount: m.totalDeposits, danger: false },
                    { label: "Closing Position", amount: m.closingPosition, danger: true },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded-xl border bg-card p-3.5">
                      <p className="text-[11.5px] text-muted-foreground">{tile.label}</p>
                      <p className="tnum mt-1 text-[16px] font-bold tracking-tight">
                        <MoneyValue amount={tile.amount} currency={m.currency} />
                      </p>
                      <p className={`mt-0.5 text-[10.5px] ${tile.danger ? "text-destructive" : "text-muted-foreground"}`}>
                        This Month
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <BoothsSection booths={booths} canManage={canManage} agentId={agent.id} />
            </TabsContent>

            <TabsContent value="booths" className="mt-4">
              <BoothsSection booths={booths} canManage={canManage} agentId={agent.id} headerLess />
            </TabsContent>

            {/* Assistants */}
            <TabsContent value="assistants" className="mt-4">
              <Card className="gap-0 py-0 shadow-xs">
                <CardHeader className="px-4 pt-4 sm:px-5">
                  <CardTitle className="text-[14.5px] font-semibold">Assistants</CardTitle>
                  {canManage && (
                    <CardAction>
                      <Button size="sm" className="h-8 gap-1.5 text-[12.5px]">
                        <Plus className="size-3.5" aria-hidden /> Add Assistant
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5">
                  {assistants.length === 0 && (
                    <p className="py-6 text-center text-[13px] text-muted-foreground">
                      No assistants yet.
                    </p>
                  )}
                  {assistants.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3.5">
                      <AgentAvatar name={a.fullName} size="sm" />
                      <div className="min-w-[140px] flex-1">
                        <p className="text-[13.5px] font-semibold">{a.fullName}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {a.email} · {a.boothName ?? "Unassigned"}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                      {canManage && a.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-[12px]">
                            <Check className="size-3.5" aria-hidden /> Approve
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost" className="h-8 gap-1 text-[12px] text-destructive">
                                <X className="size-3.5" aria-hidden /> Reject
                              </Button>
                            }
                            title="Reject assistant request?"
                            description={`${a.fullName} (@${a.boothName ?? "unassigned"}) will not be granted access.`}
                            confirmLabel="Reject"
                            destructive
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-4">
              <Card className="gap-0 py-0 shadow-xs">
                <CardContent className="space-y-2.5 p-4 sm:p-5">
                  {[
                    { name: "National ID — scanned.pdf", meta: "PDF · 1.2 MB · Verified" },
                    { name: "Proof of residence.pdf", meta: "PDF · 0.9 MB · Verified" },
                    { name: "IceCash registration.pdf", meta: "PDF · 0.6 MB" },
                  ].map((d) => (
                    <div key={d.name} className="flex items-center gap-3 rounded-xl border p-3.5">
                      <FileText className="size-4.5 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">{d.name}</p>
                        <p className="text-[11.5px] text-muted-foreground">{d.meta}</p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Download">
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reconciliations */}
            <TabsContent value="reconciliations" className="mt-4">
              <Card className="gap-0 py-0 shadow-xs">
                <CardContent className="divide-y p-0">
                  {reconciliations.length === 0 && (
                    <p className="p-6 text-center text-[13px] text-muted-foreground">
                      No reconciliations recorded for this agent.
                    </p>
                  )}
                  {reconciliations.map((r) => (
                    <Link
                      key={r.id}
                      href={`/app/reconciliation/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[12.5px] font-medium">{r.id}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {moduleName(r.module)} · {r.period}
                        </p>
                      </div>
                      <div className="text-right">
                        <MoneyValue amount={r.closingPosition} currency={r.currency} className="text-[13px]" />
                        <div className="mt-0.5">
                          <StatusBadge status={r.status} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity" className="mt-4">
              <Card className="gap-0 py-0 shadow-xs">
                <CardContent className="p-4 sm:p-5">
                  <ActivityFeed items={activities} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function BoothsSection({
  booths,
  canManage,
  headerLess = false,
}: {
  booths: Booth[];
  canManage: boolean;
  agentId: string;
  headerLess?: boolean;
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      {!headerLess && (
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Booths</CardTitle>
          {canManage && (
            <CardAction>
              <Button size="sm" className="h-8 gap-1.5 text-[12.5px]">
                <Plus className="size-3.5" aria-hidden /> Add Booth
              </Button>
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className="px-4 pb-4 sm:px-5">
        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border sm:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2.5 w-10">#</th>
                <th className="px-3 py-2.5">Booth Name</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Status</th>
                {canManage && <th className="px-3 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {booths.map((b, i) => (
                <tr key={b.id} className="hover:bg-surface-hover">
                  <td className="tnum px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Store className="size-3.5 text-primary" aria-hidden />
                      {b.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{b.location}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-right">
                      <BoothActions id={b.id} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2.5 sm:hidden">
          {booths.map((b) => (
            <div key={b.id} className="rounded-xl border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <MapPin className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{b.name}</p>
                  <p className="text-[12px] text-muted-foreground">{b.location}</p>
                </div>
                {canManage && <BoothActions id={b.id} />}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <StatusBadge status={b.status} />
                <span className="text-[11.5px] text-muted-foreground">
                  {b.assistantsCount} assistant{b.assistantsCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))}
          {booths.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted-foreground">No booths yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BoothActions({ id }: { id: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Booth ${id} actions`}>
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Open</DropdownMenuItem>
        <DropdownMenuItem>Edit booth</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive">Deactivate</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
