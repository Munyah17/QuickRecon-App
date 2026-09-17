"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  CloudUpload,
  Plus,
  Check,
  X,
  FileWarning,
  ClipboardList,
  Landmark,
  MessageSquare,
  Clock,
  UserPlus,
  Send,
  ShieldCheck,
  ListTodo,
  Trash2,
  Share2,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { Submission, SubmissionType, Task, TaskMilestone } from "@/types";

const TYPE_META: Record<SubmissionType, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  monthly_field_report: { label: "Report", icon: FileText, tone: "bg-primary-soft text-primary" },
  icecash_registration: { label: "IceCash", icon: ShieldCheck, tone: "bg-primary-soft text-primary" },
  zinara_registration: { label: "ZINARA", icon: Landmark, tone: "bg-info-soft text-info-foreground" },
  proof_of_payment: { label: "POP", icon: Landmark, tone: "bg-info-soft text-info-foreground" },
  customer_query: { label: "Query", icon: ClipboardList, tone: "bg-success-soft text-success-foreground" },
  expense_document: { label: "Expense", icon: FileText, tone: "bg-warning-soft text-warning-foreground" },
  error_report: { label: "Support", icon: FileWarning, tone: "bg-destructive-soft text-destructive" },
  support_document: { label: "Document", icon: FileText, tone: "bg-muted text-muted-foreground" },
  other: { label: "Other", icon: FileText, tone: "bg-muted text-muted-foreground" },
};

const TYPE_OPTIONS: [SubmissionType, string][] = [
  ["icecash_registration", "IceCash — Insurance Registration"],
  ["zinara_registration", "IceCash — ZINARA Vehicle License"],
  ["monthly_field_report", "Monthly Field Report"],
  ["proof_of_payment", "Proof of Payment"],
  ["customer_query", "Customer Query"],
  ["expense_document", "Expense/Business Document"],
  ["error_report", "Error Report"],
  ["support_document", "Support Document"],
  ["other", "Other"],
];

const TABS = ["all", "pending", "under_review", "completed"] as const;

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="p-4">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className="tnum mt-1 text-[22px] font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function SubmissionsView({
  submissions,
  tasks,
  agents,
  staff,
  isCompanyUser,
  isAdmin,
  startOpen = false,
}: {
  submissions: Submission[];
  tasks: Task[];
  agents: { id: string; fullName: string }[];
  staff: { id: string; fullName: string }[];
  isCompanyUser: boolean;
  isAdmin: boolean;
  startOpen?: boolean;
}) {
  const [view, setView] = React.useState<"tasks" | "submissions">("tasks");
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("all");
  const [open, setOpen] = React.useState(startOpen);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [followUpTask, setFollowUpTask] = React.useState<Submission | null>(null);

  const filtered = React.useMemo(
    () => (tab === "all" ? submissions : submissions.filter((s) => s.status === tab)),
    [submissions, tab]
  );

  const counts = React.useMemo(
    () => ({
      total: submissions.length,
      pending: submissions.filter((s) => s.status === "pending").length,
      underReview: submissions.filter((s) => s.status === "under_review").length,
      completed: submissions.filter((s) => s.status === "completed").length,
    }),
    [submissions]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {(["tasks", "submissions"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              view === v
                ? "h-8 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                : "h-8 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
            }
          >
            {v === "tasks" ? "Tasks" : "Submissions"}
          </button>
        ))}
      </div>

      {view === "tasks" ? (
        <TasksPanel
          tasks={tasks}
          agents={agents}
          staff={staff}
          isCompanyUser={isCompanyUser}
          isAdmin={isAdmin}
        />
      ) : (
        <>
      {!isCompanyUser && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Total Submissions" value={counts.total} />
          <StatTile label="Pending" value={counts.pending} />
          <StatTile label="Under Review" value={counts.underReview} />
          <StatTile label="Completed" value={counts.completed} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!isCompanyUser && (
          <>
            <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto" onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> New Submission
            </Button>
            <NewSubmissionDialog open={open} onOpenChange={setOpen} />
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const count = t === "all" ? submissions.length : submissions.filter((s) => s.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                  : "h-8 shrink-0 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
              }
            >
              {t === "all" ? `All (${count})` : t === "under_review" ? `Under Review (${count})` : `${t[0].toUpperCase() + t.slice(1)} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Desktop: table (mockup PC — My Submissions) */}
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="w-10 px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Submission Type</th>
              <th className="px-4 py-2.5">Title</th>
              {isCompanyUser && <th className="px-4 py-2.5">Agent</th>}
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Submitted On</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((s, i) => {
              const meta = TYPE_META[s.type];
              return (
                <tr key={s.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">{TYPE_OPTIONS.find(([v]) => v === s.type)?.[1] ?? meta.label}</td>
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  {isCompanyUser && <td className="px-4 py-3 text-muted-foreground">{s.agentName}</td>}
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(s.submittedAt, "dd MMM yyyy")}</td>
                  <td className="px-4 py-3 text-right">
                    {isCompanyUser && (s.status === "pending" || s.status === "under_review") ? (
                      <div className="flex justify-end gap-1.5">
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px] text-success-foreground">
                              <Check className="size-3.5" /> Approve
                            </Button>
                          }
                          title="Approve task?"
                          description={`"${s.title}" from ${s.agentName} will be marked completed. Both you and the agent will receive an email notification.`}
                          confirmLabel="Approve"
                          onConfirm={() => toast.success(`Task approved. Email sent to ${s.agentName} and you.`)}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-[12px] text-destructive">
                              <X className="size-3.5" /> Reject
                            </Button>
                          }
                          title="Reject task?"
                          description="The agent will be notified via email and may re-submit."
                          confirmLabel="Reject"
                          destructive
                          onConfirm={() => toast.success(`Task rejected. Email sent to ${s.agentName}.`)}
                        />
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 text-[12px] text-primary">View</Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isCompanyUser ? 7 : 6} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                  No submissions in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card stack */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((s) => {
          const meta = TYPE_META[s.type];
          const Icon = meta.icon;
          return (
            <Card key={s.id} className="gap-0 py-0 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${meta.tone}`}>
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{s.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {meta.label} · {formatDate(s.submittedAt, "dd MMM yyyy")}
                      {isCompanyUser ? ` · ${s.agentName}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {isCompanyUser && (s.status === "pending" || s.status === "under_review") && (
                    <>
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] text-success-foreground">
                            <Check className="size-3.5" /> Approve
                          </Button>
                        }
                        title="Approve task?"
                        description={`"${s.title}" from ${s.agentName} will be marked completed. Both you and the agent will receive an email notification.`}
                        confirmLabel="Approve"
                        onConfirm={() => toast.success(`Task approved. Email sent to ${s.agentName} and you.`)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-[12px]"
                        onClick={() => setFollowUpTask(s)}
                      >
                        <MessageSquare className="size-3.5" /> Follow Up
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[12px] text-destructive">
                            <X className="size-3.5" /> Reject
                          </Button>
                        }
                        title="Reject task?"
                        description="The agent will be notified via email and may re-submit."
                        confirmLabel="Reject"
                        destructive
                        onConfirm={() => toast.success(`Task rejected. Email sent to ${s.agentName}.`)}
                      />
                    </>
                  )}
                  {!isCompanyUser && s.status === "completed" && (
                    <span className="text-[12px] text-muted-foreground">
                      Completed on {formatDate(s.submittedAt, "dd MMM yyyy")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
            No tasks in this category.
          </p>
        )}
      </div>
        </>
      )}

      {followUpTask && (
        <FollowUpDialog
          task={followUpTask}
          open={!!followUpTask}
          onOpenChange={(v) => !v && setFollowUpTask(null)}
        />
      )}
    </div>
  );
}

/** Task list with milestone tracking — visible tasks are already scoped by
 * RLS server-side; the shared flag is additionally filtered client-side for
 * non-admin company roles. */
function TasksPanel({
  tasks,
  agents,
  staff,
  isCompanyUser,
  isAdmin,
}: {
  tasks: Task[];
  agents: { id: string; fullName: string }[];
  staff: { id: string; fullName: string }[];
  isCompanyUser: boolean;
  isAdmin: boolean;
}) {
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "pending" | "in_progress" | "completed">("all");

  const visible = React.useMemo(
    () => tasks.filter((t) => isAdmin || !t.shared),
    [tasks, isAdmin]
  );
  const filtered =
    filter === "all" ? visible : visible.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isCompanyUser && (
          <Button className="h-10 gap-2 text-[13.5px]" onClick={() => setAssignOpen(true)}>
            <UserPlus className="size-4" aria-hidden /> Assign Task
          </Button>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "pending", "in_progress", "completed"] as const).map((f) => {
            const count = f === "all" ? visible.length : visible.filter((t) => t.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                    : "h-8 shrink-0 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
                }
              >
                {f === "all" ? `All (${count})` : f === "in_progress" ? `In Progress (${count})` : `${f[0].toUpperCase() + f.slice(1)} (${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
          {filter === "all" ? "No tasks assigned yet." : `No ${filter.replace("_", " ")} tasks.`}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}

      {isCompanyUser && (
        <AssignTaskDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          agents={agents}
          staff={staff}
        />
      )}
    </div>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  urgent: "text-destructive",
  high: "text-warning-foreground",
  normal: "text-muted-foreground",
  low: "text-muted-foreground",
};

function TaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const done = task.milestones.filter((m) => m.done).length;
  const total = task.milestones.length;
  const pct = total
    ? Math.round((done / total) * 100)
    : task.status === "completed"
      ? 100
      : 0;

  async function toggleMilestone(m: TaskMilestone) {
    setBusy(m.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: m.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update milestone");
    } finally {
      setBusy(null);
    }
  }

  async function markComplete() {
    setBusy("complete");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success("Task completed", {
        description: "Assignee notified via SMS and WhatsApp.",
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete task");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              <span className="truncate">{task.title}</span>
              {task.shared && (
                <Share2 className="size-3.5 shrink-0 text-muted-foreground" aria-label="Shared task — admins only" />
              )}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {task.assigneeName} · {task.assigneeType === "agent" ? "Agent" : "Staff"}
              {task.dueDate ? ` · Due ${formatDate(task.dueDate, "dd MMM yyyy")}` : ""}
            </p>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {task.description ? (
          <p className="text-[12.5px] leading-5 text-muted-foreground">{task.description}</p>
        ) : null}

        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ListTodo className="size-3.5" aria-hidden /> Milestones
              </span>
              <span className="tnum">{done}/{total} · {pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
            <ul className="space-y-1.5">
              {task.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`${task.id}-${m.id}`}
                    checked={m.done}
                    disabled={busy === m.id || task.status === "completed"}
                    onCheckedChange={() => toggleMilestone(m)}
                  />
                  <label
                    htmlFor={`${task.id}-${m.id}`}
                    className={`text-[12.5px] ${m.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {m.title}
                  </label>
                  {busy === m.id && (
                    <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className={`text-[11px] font-semibold tracking-wide uppercase ${PRIORITY_TONE[task.priority] ?? "text-muted-foreground"}`}>
            {task.priority}
          </span>
          {task.status !== "completed" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[12px]"
              disabled={busy === "complete"}
              onClick={markComplete}
            >
              {busy === "complete" ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CircleCheck className="size-3.5" aria-hidden />
              )}
              Mark Complete
            </Button>
          ) : (
            task.completedAt && (
              <span className="text-[11.5px] text-muted-foreground">
                Completed {formatDate(task.completedAt, "dd MMM yyyy")}
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AssignTaskDialog({
  open,
  onOpenChange,
  agents,
  staff,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agents: { id: string; fullName: string }[];
  staff: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [assigneeType, setAssigneeType] = React.useState<"agent" | "staff">("agent");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [dueDate, setDueDate] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [milestones, setMilestones] = React.useState<string[]>([
    "Milestone 1",
    "Milestone 2",
    "Milestone 3",
    "Milestone 4",
    "Milestone 5",
  ]);
  const [saving, setSaving] = React.useState(false);

  const options = assigneeType === "agent" ? agents : staff;

  function reset() {
    setAssigneeType("agent");
    setAssigneeId("");
    setTitle("");
    setDescription("");
    setPriority("normal");
    setDueDate("");
    setShared(false);
    setMilestones(["Milestone 1", "Milestone 2", "Milestone 3", "Milestone 4", "Milestone 5"]);
  }

  async function assign() {
    if (!assigneeId || !title.trim()) {
      toast.error("Select an assignee and provide a task title");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          assigneeType,
          assigneeId,
          shared,
          milestones: milestones
            .filter((m) => m.trim())
            .map((t) => ({ title: t.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign task");
      toast.success("Task assigned", {
        description: data.whatsappSent
          ? "Assignee notified on WhatsApp."
          : "Saved — WhatsApp notification could not be sent (no phone on record or provider not configured).",
      });
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
          <DialogDescription>
            Assign to a staff member or agent. The assignee is notified on
            WhatsApp immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select
                value={assigneeType}
                onValueChange={(v) => {
                  setAssigneeType(v as "agent" | "staff");
                  setAssigneeId("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="staff">Staff Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {assigneeType === "agent" ? "Agent" : "Staff Member"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${assigneeType}`} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.fullName} ({o.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-title">
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="assign-title"
              placeholder="e.g. Submit August reconciliation report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-desc">Description / Instructions</Label>
            <Textarea
              id="assign-desc"
              rows={3}
              placeholder="Provide detailed instructions…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="assign-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="assign-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assign-due">Due Date</Label>
              <Input
                id="assign-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Milestones</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[12px]"
                onClick={() => setMilestones((m) => [...m, `Milestone ${m.length + 1}`])}
              >
                <Plus className="size-3.5" aria-hidden /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="tnum w-5 text-right text-[11px] text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={m}
                    onChange={(e) =>
                      setMilestones((ms) => ms.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    className="h-8 text-[12.5px]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove milestone"
                    disabled={milestones.length <= 1}
                    onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              The assignee ticks off each milestone; admins are notified on every completion.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-[12.5px] font-medium">Shared task</p>
              <p className="text-[11px] text-muted-foreground">
                Only Super Admins, Admins and the assignee can see this task.
              </p>
            </div>
            <Switch checked={shared} onCheckedChange={setShared} aria-label="Shared task" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={assign} disabled={saving}>
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Assign & Notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Submission;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [message, setMessage] = React.useState("");

  function send() {
    toast.success(`Follow-up sent to ${task.agentName}`, {
      description: "Email notification sent to the agent.",
    });
    setMessage("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Follow Up: {task.title}</DialogTitle>
          <DialogDescription>
            Send a follow-up message to {task.agentName}. They will receive an
            email notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              Submitted on {formatDate(task.submittedAt, "dd MMM yyyy")}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followup-msg">Follow-up Message</Label>
            <Textarea
              id="followup-msg"
              rows={4}
              placeholder="Type your follow-up message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send}>
            <Send className="size-4" aria-hidden /> Send Follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewSubmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [type, setType] = React.useState<SubmissionType>("monthly_field_report");
  const [files, setFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isRegistration = type === "icecash_registration" || type === "zinara_registration";
  const [regRef, setRegRef] = React.useState("");
  const [floatUsed, setFloatUsed] = React.useState("");
  const [remitted, setRemitted] = React.useState("");

  function submit() {
    if (isRegistration && (!regRef.trim() || !floatUsed.trim() || !remitted.trim())) {
      toast.error("Registration details required", {
        description: "Reference number, float used and amount remitted are required.",
      });
      return;
    }
    toast.success(isRegistration ? "Registration submitted" : "Task submitted", {
      description: isRegistration
        ? `${regRef} recorded — float ${floatUsed}, remitted ${remitted}. It feeds your reconciliation.`
        : "Company staff will review it. You'll receive an email notification when it's reviewed.",
    });
    onOpenChange(false);
    setFiles([]);
    setRegRef(""); setFloatUsed(""); setRemitted("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Submission</DialogTitle>
          <DialogDescription>
            Submit work documents to the operations team. You&apos;ll receive email
            notifications at each stage of the review process.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Submission Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SubmissionType)}>
              <SelectTrigger aria-label="Submission type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isRegistration && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-3.5">
              <p className="text-[12px] font-semibold text-primary">
                {type === "icecash_registration" ? "Insurance registration" : "ZINARA vehicle license"} — tracked for reconciliation
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sub-ref">
                  {type === "icecash_registration" ? "Policy / IceCash Reference" : "Vehicle Registration Number"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sub-ref"
                  className="bg-card"
                  placeholder={type === "icecash_registration" ? "e.g. ENP-2026-00421" : "e.g. ABR 1234"}
                  value={regRef}
                  onChange={(e) => setRegRef(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sub-float">Float Used (ZiG) <span className="text-destructive">*</span></Label>
                  <Input id="sub-float" type="number" className="bg-card" placeholder="0.00" value={floatUsed} onChange={(e) => setFloatUsed(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-remitted">Amount Remitted (ZiG) <span className="text-destructive">*</span></Label>
                  <Input id="sub-remitted" type="number" className="bg-card" placeholder="0.00" value={remitted} onChange={(e) => setRemitted(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="sub-title">Title</Label>
            <Input id="sub-title" placeholder="e.g. Monthly Field Report" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">Description</Label>
            <Textarea id="sub-desc" rows={3} placeholder="Brief context for the reviewer…" />
          </div>

          <div className="space-y-2">
            <Label>Files</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-[13px] text-muted-foreground hover:border-primary/50 hover:bg-primary-soft/30"
            >
              <CloudUpload className="size-6 text-primary" aria-hidden />
              Tap to attach documents
              <span className="text-[11px]">PDF, images, Excel — up to 25MB each</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.map((f) => (
              <p key={f.name} className="flex items-center gap-2 text-[12px]">
                <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                {f.name}
              </p>
            ))}
          </div>

          <Button className="w-full" onClick={submit}>Submit</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
