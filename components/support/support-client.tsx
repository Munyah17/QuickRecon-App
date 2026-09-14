"use client";

import * as React from "react";
import { LifeBuoy, Plus } from "lucide-react";
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
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      {!isCompanyUser && (
        <Button className="h-10 w-full gap-2 text-[13.5px] lg:w-auto" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Create Support Ticket
        </Button>
      )}

      <div className="space-y-3">
        {tickets.length === 0 && (
          <Card className="gap-0 py-10 text-center shadow-xs">
            <LifeBuoy className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-[13.5px] font-semibold">No tickets yet</p>
          </Card>
        )}
        {tickets.map((t) => (
          <Card key={t.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[180px] flex-1">
                <p className="text-[13.5px] font-semibold">{t.subject}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  <span className="font-mono">{t.id}</span> ·{" "}
                  {CATEGORIES.find(([c]) => c === t.category)?.[1]} ·{" "}
                  {t.module === "general" ? "General" : moduleName(t.module)}
                  {isCompanyUser ? ` · ${t.agentName}` : ""} ·{" "}
                  {formatDate(t.createdAt, "dd MMM yyyy")}
                </p>
              </div>
              <StatusBadge status={t.status} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>Technical or account assistance from the support team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select defaultValue="technical">
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" placeholder="Short summary…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-desc">Description</Label>
              <Textarea id="ticket-desc" rows={4} placeholder="What happened, when, and what you expected…" />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                toast.success("Ticket created", { description: "Support will respond in-app." });
                setOpen(false);
              }}
            >
              Submit ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
