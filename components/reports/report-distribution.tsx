"use client";

import * as React from "react";
import { Download, Eye, Mail, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, formatPeriod, moduleName } from "@/lib/format";
import type { DistributionJob } from "@/types";

const DEFAULT_MESSAGE = `Dear Agent,

Please find attached your latest reconciliation report for August 2026.

Regards,
Enpassent Team`;

/**
 * Super Admin "Generate & Send Reports" — recipients, formats, channels,
 * message, send/preview, schedule, history. (PC mockup screen 7)
 */
export function ReportDistribution({ history }: { history: DistributionJob[] }) {
  const [recipients, setRecipients] = React.useState("all");
  const [formats, setFormats] = React.useState<string[]>(["xlsx", "pdf"]);
  const [channels, setChannels] = React.useState<string[]>(["email", "whatsapp"]);
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: boolean) =>
    set(on ? [...list, id] : list.filter((x) => x !== id));

  const filteredHistory = React.useMemo(
    () =>
      history.filter((d) => {
        if (dateFrom && new Date(d.createdAt) < new Date(dateFrom)) return false;
        if (dateTo && new Date(d.createdAt) > new Date(dateTo + "T23:59:59")) return false;
        return true;
      }),
    [history, dateFrom, dateTo]
  );

  return (
    <Tabs defaultValue="send">
      <TabsList variant="line" className="w-full justify-start gap-5 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="send" className="rounded-none px-1 pb-2.5 text-[13px]">Send Reports</TabsTrigger>
        <TabsTrigger value="schedule" className="rounded-none px-1 pb-2.5 text-[13px]">Schedule</TabsTrigger>
        <TabsTrigger value="history" className="rounded-none px-1 pb-2.5 text-[13px]">History</TabsTrigger>
      </TabsList>

      <TabsContent value="send" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <StepCard n={1} title="Select Recipients">
            <RadioGroup value={recipients} onValueChange={setRecipients} className="space-y-2.5">
              {[
                ["all", "All Agents (236)"],
                ["selected", "Selected Agents"],
                ["single", "Single Agent"],
              ].map(([v, label]) => (
                <div key={v} className="flex items-center gap-2.5">
                  <RadioGroupItem value={v} id={`r-${v}`} />
                  <Label htmlFor={`r-${v}`} className="text-[13px] font-normal">{label}</Label>
                </div>
              ))}
            </RadioGroup>
          </StepCard>

          <StepCard n={2} title="Report Format">
            {[
              ["xlsx", "Excel (.xlsx)"],
              ["pdf", "PDF"],
              ["csv", "CSV"],
              ["docx", "Word (.docx)"],
            ].map(([v, label]) => (
              <label key={v} className="flex items-center gap-2.5 py-1 text-[13px]">
                <Checkbox
                  checked={formats.includes(v)}
                  onCheckedChange={(c) => toggle(formats, setFormats, v, c === true)}
                />
                {label}
              </label>
            ))}
          </StepCard>

          <StepCard n={3} title="Delivery Channels">
            <label className="flex items-center gap-2.5 py-1 text-[13px]">
              <Checkbox
                checked={channels.includes("email")}
                onCheckedChange={(c) => toggle(channels, setChannels, "email", c === true)}
              />
              <Mail className="size-4 text-muted-foreground" aria-hidden /> Email
            </label>
            <label className="flex items-center gap-2.5 py-1 text-[13px]">
              <Checkbox
                checked={channels.includes("whatsapp")}
                onCheckedChange={(c) => toggle(channels, setChannels, "whatsapp", c === true)}
              />
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden /> WhatsApp
            </label>
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
              229 agents have a valid email · 214 have WhatsApp on record · 7 have no deliverable channel.
            </p>
          </StepCard>

          <StepCard n={4} title="Message (Optional)">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={500}
              className="resize-none text-[13px]"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {message.length}/500
            </p>
          </StepCard>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ConfirmDialog
            trigger={
              <Button className="h-9 gap-1.5 text-[13px]" disabled={formats.length === 0 || channels.length === 0}>
                <Send className="size-4" aria-hidden /> Send Now
              </Button>
            }
            title="Queue distribution?"
            description={`Reports will be generated and delivered to ${recipients === "all" ? "236 agents" : "the selected agents"} via ${channels.join(" + ")}. Delivery history is tracked per recipient.`}
            confirmLabel="Send Now"
            onConfirm={() =>
              toast.success("Distribution queued", {
                description: "Generating reports and queueing deliveries…",
              })
            }
          />
          <Button variant="outline" className="h-9 gap-1.5 text-[13px]">
            <Eye className="size-4" aria-hidden /> Preview (5 agents)
          </Button>
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[13px]"
            onClick={() => toast.success("Report exported", { description: `Exported as ${formats[0]?.toUpperCase() ?? "XLSX"}` })}
          >
            <Download className="size-4" aria-hidden /> Export
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="schedule" className="mt-4">
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="max-w-md space-y-4 p-5">
            <ScheduleField label="Frequency" value="Monthly — on the 1st at 06:00" />
            <ScheduleField label="Recipients" value="All Agents" />
            <ScheduleField label="Channels" value="Email + WhatsApp" />
            <ScheduleField label="Next run" value="1 October 2026, 06:00 (CAT)" />
            <Button className="h-9 text-[13px]">Send Now (override)</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-auto bg-card text-[12.5px]"
              aria-label="From date"
            />
            <span className="text-[12px] text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-auto bg-card text-[12.5px]"
              aria-label="To date"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-[12px]"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
            >
              Clear
            </Button>
          )}
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[13px] ml-auto"
            onClick={() => toast.success("History exported", { description: `${filteredHistory.length} records exported as XLSX` })}
          >
            <Download className="size-4" aria-hidden /> Export History
          </Button>
        </div>
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="divide-y p-0">
            {filteredHistory.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">
                    {formatPeriod(d.period)} — {moduleName(d.module)}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {d.recipientsCount} recipients · {d.channels.join(" + ")} · {formatDate(d.createdAt, "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted-foreground">
                No distributions in this date range.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="flex-row items-center gap-3 px-4 pt-4 sm:px-5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
          {n}
        </span>
        <CardTitle className="text-[14px] font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-2 pb-4 sm:px-5">{children}</CardContent>
    </Card>
  );
}

function ScheduleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
