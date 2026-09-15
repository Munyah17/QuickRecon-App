"use client";

import * as React from "react";
import { Headset, LifeBuoy, BookOpen, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, moduleName } from "@/lib/format";
import type { SupportTicket, TicketCategory } from "@/types";

const CATEGORIES: [TicketCategory, string][] = [
  ["technical", "Technical"],
  ["account_access", "Account Access"],
  ["reconciliation_query", "Reconciliation Query"],
  ["submission_issue", "Submission Issue"],
  ["report_issue", "Report Issue"],
  ["other", "Other"],
];

export function SupportClient({
  tickets,
  isCompanyUser,
}: {
  tickets: SupportTicket[];
  isCompanyUser: boolean;
}) {
  const [category, setCategory] = React.useState<TicketCategory>("technical");
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [selected, setSelected] = React.useState<SupportTicket | null>(null);
  const [localTickets, setLocalTickets] = React.useState<SupportTicket[]>(tickets);

  async function submitTicket() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket");
      setLocalTickets((prev) => [
        {
          id: data.id,
          agentId: "",
          agentName: "",
          module: "general",
          category,
          subject: subject.trim(),
          status: "open",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success(`Ticket ${data.id} created`, { description: "Support will respond in-app." });
      setSubject("");
      setDescription("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: SupportTicket["status"]) {
    try {
      const res = await fetch("/api/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      setSelected((s) => (s && s.id === id ? { ...s, status } : s));
      toast.success(`Ticket ${id} marked ${status.replace("_", " ")}`);
    } catch {
      toast.error("Could not update ticket");
    }
  }

  return (
    <div className="space-y-4">
      {!isCompanyUser && (
        <>
          {/* Contact / Help Center cards (mockup 10) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="gap-0 py-0 shadow-xs">
              <CardContent className="p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Headset className="size-5" aria-hidden />
                </span>
                <p className="mt-3 text-[14px] font-semibold">Contact Support</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Need immediate assistance? Reach out to our support team.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 h-8.5 text-[12.5px]"
                  onClick={() =>
                    toast.info("Support contact", {
                      description: "support@enpassent.co.zw · +263 242 123 456",
                    })
                  }
                >
                  Contact Support
                </Button>
              </CardContent>
            </Card>
            <Card className="gap-0 py-0 shadow-xs">
              <CardContent className="p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <p className="mt-3 text-[14px] font-semibold">Help Center</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Find answers to common questions and guides.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 h-8.5 text-[12.5px]"
                  onClick={() => toast.info("Help Center", { description: "Guides and FAQs coming online soon." })}
                >
                  View Help Center
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Inline ticket form (mockup 10) */}
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <p className="text-[14px] font-semibold">Create Support Ticket</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Issue Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                    <SelectTrigger aria-label="Issue category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(([v, label]) => (
                        <SelectItem key={v} value={v}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-subject">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ticket-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter a short subject"
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-desc">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ticket-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about your issue…"
                  className="bg-card"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="h-9 text-[13px]"
                  disabled={!subject.trim() || description.trim().length < 10 || submitting}
                  onClick={submitTicket}
                >
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recent tickets — table on desktop, cards on mobile */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[14px] font-semibold">Recent Tickets</p>
          <span className="tnum text-[12px] text-muted-foreground">{localTickets.length} total</span>
        </div>

        <Card className="hidden gap-0 overflow-hidden py-0 shadow-xs lg:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created On</th>
                {isCompanyUser && <th className="px-4 py-2.5">Agent</th>}
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {localTickets.map((t, i) => (
                <tr key={t.id} className="cursor-pointer hover:bg-surface-hover" onClick={() => setSelected(t)}>
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CATEGORIES.find(([c]) => c === t.category)?.[1]}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(t.createdAt, "dd MMM yyyy")}
                  </td>
                  {isCompanyUser && <td className="px-4 py-3 text-muted-foreground">{t.agentName || "—"}</td>}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {isCompanyUser && t.status !== "resolved" && t.status !== "closed" ? (
                      <div className="flex justify-end gap-1.5">
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]">
                              <Clock className="size-3.5" /> In Progress
                            </Button>
                          }
                          title={`Mark ${t.id} in progress?`}
                          description="The agent will see the ticket is being worked on."
                          confirmLabel="Mark In Progress"
                          onConfirm={() => updateStatus(t.id, "in_progress")}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px] text-success-foreground">
                              <Check className="size-3.5" /> Resolve
                            </Button>
                          }
                          title={`Resolve ${t.id}?`}
                          description={`"${t.subject}" will be marked resolved and the agent notified.`}
                          confirmLabel="Resolve"
                          onConfirm={() => updateStatus(t.id, "resolved")}
                        />
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 text-[12px] text-primary" onClick={() => setSelected(t)}>
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {localTickets.length === 0 && (
                <tr>
                  <td colSpan={isCompanyUser ? 7 : 6} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    No tickets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-3 lg:hidden">
          {localTickets.length === 0 && (
            <Card className="gap-0 py-10 text-center shadow-xs">
              <LifeBuoy className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-[13.5px] font-semibold">No tickets yet</p>
            </Card>
          )}
          {localTickets.map((t) => (
            <Card key={t.id} className="gap-0 py-0 shadow-xs">
              <CardContent
                className="flex flex-wrap items-center gap-3 p-4 cursor-pointer"
                onClick={() => setSelected(t)}
              >
                <div className="min-w-[180px] flex-1">
                  <p className="text-[13.5px] font-semibold">{t.subject}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    <span className="font-mono">{t.id}</span> ·{" "}
                    {CATEGORIES.find(([c]) => c === t.category)?.[1]} ·{" "}
                    {t.module === "general" ? "General" : moduleName(t.module)}
                    {isCompanyUser && t.agentName ? ` · ${t.agentName}` : ""} ·{" "}
                    {formatDate(t.createdAt, "dd MMM yyyy")}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Ticket detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[460px]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[15px]">{selected.subject}</DialogTitle>
                <DialogDescription className="font-mono text-[12px]">{selected.id}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-medium">
                    {CATEGORIES.find(([c]) => c === selected.category)?.[1]}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-medium">
                    {selected.module === "general" ? "General" : moduleName(selected.module)}
                  </span>
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  {selected.agentName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Agent</dt>
                      <dd className="font-medium">{selected.agentName} ({selected.agentId})</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{formatDate(selected.createdAt, "dd MMM yyyy, HH:mm")}</dd>
                  </div>
                </dl>
              </div>
              <DialogFooter className="gap-2">
                {isCompanyUser && selected.status !== "resolved" && selected.status !== "closed" ? (
                  <>
                    <Button variant="outline" className="gap-1.5" onClick={() => updateStatus(selected.id, "in_progress")}>
                      <Clock className="size-4" aria-hidden /> In Progress
                    </Button>
                    <Button className="gap-1.5" onClick={() => updateStatus(selected.id, "resolved")}>
                      <Check className="size-4" aria-hidden /> Resolve
                    </Button>
                    <Button variant="ghost" className="gap-1.5 text-destructive" onClick={() => updateStatus(selected.id, "closed")}>
                      <X className="size-4" aria-hidden /> Close
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
