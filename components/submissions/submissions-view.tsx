"use client";

import * as React from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { Submission, SubmissionType } from "@/types";

const TYPE_META: Record<SubmissionType, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  monthly_field_report: { label: "Report", icon: FileText, tone: "bg-primary-soft text-primary" },
  proof_of_payment: { label: "POP", icon: Landmark, tone: "bg-info-soft text-info-foreground" },
  customer_query: { label: "Query", icon: ClipboardList, tone: "bg-success-soft text-success-foreground" },
  expense_document: { label: "Expense", icon: FileText, tone: "bg-warning-soft text-warning-foreground" },
  error_report: { label: "Support", icon: FileWarning, tone: "bg-destructive-soft text-destructive" },
  support_document: { label: "Document", icon: FileText, tone: "bg-muted text-muted-foreground" },
  other: { label: "Other", icon: FileText, tone: "bg-muted text-muted-foreground" },
};

const TYPE_OPTIONS: [SubmissionType, string][] = [
  ["monthly_field_report", "Monthly Field Report"],
  ["proof_of_payment", "Proof of Payment"],
  ["customer_query", "Customer Query"],
  ["expense_document", "Expense/Business Document"],
  ["error_report", "Error Report"],
  ["support_document", "Support Document"],
  ["other", "Other"],
];

const TABS = ["all", "pending", "under_review", "completed"] as const;

export function SubmissionsView({
  submissions,
  isCompanyUser,
  startOpen = false,
}: {
  submissions: Submission[];
  isCompanyUser: boolean;
  startOpen?: boolean;
}) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("all");
  const [open, setOpen] = React.useState(startOpen);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [followUpTask, setFollowUpTask] = React.useState<Submission | null>(null);

  const filtered = React.useMemo(
    () => (tab === "all" ? submissions : submissions.filter((s) => s.status === tab)),
    [submissions, tab]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isCompanyUser && (
          <Button className="h-10 gap-2 text-[13.5px]" onClick={() => setAssignOpen(true)}>
            <UserPlus className="size-4" aria-hidden /> Assign Task
          </Button>
        )}
        {!isCompanyUser && (
          <>
            <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto" onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> New Submission
            </Button>
            <NewSubmissionDialog open={open} onOpenChange={setOpen} />
          </>
        )}
        {isCompanyUser && (
          <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} />
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

      <div className="space-y-3">
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

function AssignTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [agentName, setAgentName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [dueDate, setDueDate] = React.useState("");

  function assign() {
    if (!agentName || !title) {
      toast.error("Please select an agent and provide a task title");
      return;
    }
    toast.success(`Task assigned to ${agentName}`, {
      description: `Email notification sent to ${agentName}.`,
    });
    setAgentName("");
    setTitle("");
    setDescription("");
    setPriority("normal");
    setDueDate("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Assign Task to Agent</DialogTitle>
          <DialogDescription>
            Create a task and assign it to an agent. They will receive an email
            notification immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="assign-agent">
              Agent <span className="text-destructive">*</span>
            </Label>
            <Select value={agentName} onValueChange={setAgentName}>
              <SelectTrigger id="assign-agent">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Musa Zhou">Musa Zhou (AGT-000184)</SelectItem>
                <SelectItem value="Tendai Moyo">Tendai Moyo (AGT-000185)</SelectItem>
                <SelectItem value="Rumbi Chiweshe">Rumbi Chiweshe (AGT-000186)</SelectItem>
                <SelectItem value="Nyanga Dube">Nyanga Dube (AGT-000187)</SelectItem>
              </SelectContent>
            </Select>
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
              placeholder="Provide detailed instructions for the agent…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="assign-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="assign-priority">
                  <SelectValue />
                </SelectTrigger>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={assign}>
            <Send className="size-4" aria-hidden /> Assign & Notify
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

  function submit() {
    toast.success("Task submitted", {
      description: "Company staff will review it. You'll receive an email notification when it's reviewed.",
    });
    onOpenChange(false);
    setFiles([]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Submission</DialogTitle>
          <DialogDescription>
            Submit work documents to the operations team. You'll receive email
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
