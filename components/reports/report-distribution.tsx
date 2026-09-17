"use client";

import * as React from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
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
import { ExportButton } from "@/components/shared/export-button";
import { formatDate, formatPeriod, moduleName } from "@/lib/format";
import type { Agent, DistributionJob, Reconciliation } from "@/types";

const DEFAULT_MESSAGE = `Dear Agent,

Please find attached your latest reconciliation report for August 2026.

Regards,
Enpassent Team`;

/**
 * Super Admin "Generate & Send Reports" — recipients, formats, channels,
 * message, send/preview, schedule, history. (PC mockup screen 7)
 */
export function ReportDistribution({
  history,
  agents = [],
  recons = [],
}: {
  history: DistributionJob[];
  agents?: Agent[];
  recons?: Reconciliation[];
}) {
  const [recipients, setRecipients] = React.useState("all");
  const [formats, setFormats] = React.useState<string[]>(["xlsx", "pdf"]);
  const [channels, setChannels] = React.useState<string[]>(["email", "whatsapp"]);
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [agentQuery, setAgentQuery] = React.useState("");
  const [selectedAgents, setSelectedAgents] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);

  const agentResults = React.useMemo(() => {
    const q = agentQuery.toLowerCase();
    return agents.filter(
      (a) => a.fullName.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );
  }, [agents, agentQuery]);

  const targetRecons = React.useMemo(() => {
    const source = recipients === "all" ? recons : recons.filter((r) => selectedAgents.has(r.agentId));
    // One document per agent — never send duplicates.
    const seen = new Set<string>();
    return source.filter((r) => !seen.has(r.agentId) && seen.add(r.agentId));
  }, [recipients, recons, selectedAgents]);

  async function sendNow() {
    if (targetRecons.length === 0) {
      toast.error("No reconciliations to send", { description: "Selected agents have no published reconciliation." });
      return;
    }
    setSending(true);
    let ok = 0;
    let failed = 0;
    for (const r of targetRecons) {
      try {
        const res = await fetch("/api/reconciliation/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: r.id, agentId: r.agentId, channels }),
        });
        const data = await res.json();
        if (data.success) ok++; else failed++;
      } catch {
        failed++;
      }
    }
    setSending(false);
    toast.success(`Sent ${ok} report${ok === 1 ? "" : "s"}`, {
      description: failed ? `${failed} failed — check delivery history.` : `Each agent received only their own document via ${channels.join(" + ")}.`,
    });
  }

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
                ["all", `All Agents (${agents.length})`],
                ["selected", "Selected Agents"],
                ["single", "Single Agent"],
              ].map(([v, label]) => (
                <div key={v} className="flex items-center gap-2.5">
                  <RadioGroupItem value={v} id={`r-${v}`} />
                  <Label htmlFor={`r-${v}`} className="text-[13px] font-normal">{label}</Label>
                </div>
              ))}
            </RadioGroup>

            {recipients !== "all" && (
              <div className="mt-3 space-y-2">
                <Input
                  value={agentQuery}
                  onChange={(e) => setAgentQuery(e.target.value)}
                  placeholder="Search agent by name or ID…"
                  className="h-9 bg-card text-[13px]"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAgents(new Set(agentResults.map((a) => a.id)))
                    }
                    className="text-[12px] font-semibold text-primary hover:underline"
                  >
                    Select all ({agentResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAgents(new Set())}
                    className="text-[12px] text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {(recipients === "single" ? agentResults.slice(0, 8) : agentResults).map((a) => {
                    const on = selectedAgents.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setSelectedAgents((prev) => {
                            if (recipients === "single") return new Set([a.id]);
                            const next = new Set(prev);
                            if (on) next.delete(a.id); else next.add(a.id);
                            return next;
                          })
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                          on ? "bg-primary-soft text-primary" : "hover:bg-surface-hover"
                        }`}
                      >
                        <span className="font-medium">{a.fullName}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{a.id}</span>
                      </button>
                    );
                  })}
                  {agentResults.length === 0 && (
                    <p className="py-4 text-center text-[12px] text-muted-foreground">No agents match.</p>
                  )}
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  {selectedAgents.size} selected
                </p>
              </div>
            )}
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
              {agents.filter((a) => a.email).length} agents have email · {agents.filter((a) => a.phone).length} have phone/WhatsApp on record.
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
              <Button className="h-9 gap-1.5 text-[13px]" disabled={formats.length === 0 || channels.length === 0 || sending}>
                <Send className="size-4" aria-hidden /> {sending ? "Sending…" : "Send Now"}
              </Button>
            }
            title="Queue distribution?"
            description={`${targetRecons.length} agent reconciliation document${targetRecons.length === 1 ? "" : "s"} will be generated and delivered via ${channels.join(" + ")}. Each agent receives only their own document.`}
            confirmLabel="Send Now"
            onConfirm={sendNow}
          />
          <ExportButton
            filename={`recon-reports-${recipients}`}
            label="Export"
            data={{
              columns: ["Agent", "ID", "Period", "Insurance", "ZINARA", "Deposits", "Closing", "Status"],
              rows: targetRecons.map((r) => [r.agentName, r.agentId, r.period, r.insurance, r.zinara, r.deposits, r.closingPosition, r.status]),
            }}
          />
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
          <ExportButton
            filename="distribution-history"
            rows={filteredHistory.length}
            label="Export History"
            className="ml-auto"
            title="QuickRecon — Distribution History"
            data={{
              columns: ["Period", "Module", "Recipients", "Channels", "Sent At", "Status"],
              rows: filteredHistory.map((d) => [
                formatPeriod(d.period),
                moduleName(d.module),
                d.recipientsCount,
                d.channels.join(" + ").toUpperCase(),
                formatDate(d.createdAt, "dd MMM yyyy HH:mm"),
                d.status,
              ]),
            }}
          />
        </div>
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5">Module</th>
                  <th className="px-4 py-2.5">Recipients</th>
                  <th className="px-4 py-2.5">Channels</th>
                  <th className="px-4 py-2.5">Sent At</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium">{formatPeriod(d.period)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{moduleName(d.module)}</td>
                    <td className="tnum px-4 py-3">{d.recipientsCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.channels.join(" + ").toUpperCase()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt, "dd MMM yyyy HH:mm")}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <CardHeader className="flex flex-row items-center gap-3 px-4 pt-4 sm:px-5">
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
