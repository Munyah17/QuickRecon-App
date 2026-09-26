"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  Flag,
  ListChecks,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { ExportButton } from "@/components/shared/export-button";
import { downloadFromApi } from "@/lib/export";
import { formatMoney, formatPeriod, moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { Reconciliation, ReconException } from "@/types";

/* ------------------------------------------------------------------ */
/* Local work state — persisted per recon so a reviewer can leave and  */
/* resume hours or days later without losing progress.                  */
/* ------------------------------------------------------------------ */

const STORE_KEY = "qr-recon-workbench";

const CHECKLIST = [
  { id: "deposits", label: "Deposits verified against bank statement" },
  { id: "insurance", label: "Insurance totals checked" },
  { id: "zinara", label: "ZINARA totals checked" },
  { id: "adjustments", label: "Adjustments reviewed & justified" },
  { id: "exceptions", label: "Exceptions cleared or escalated" },
] as const;

type WorkStatus = "verified" | "flagged";

interface WorkState {
  checks: Record<string, boolean>;
  status?: WorkStatus;
  note: string;
  updatedAt: string;
}

type Store = Record<string, WorkState>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function emptyState(): WorkState {
  return { checks: {}, note: "", updatedAt: new Date().toISOString() };
}

type QueueFilter = "all" | "review" | "verified" | "flagged" | "published";

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Needs review" },
  { id: "verified", label: "Verified" },
  { id: "flagged", label: "Flagged" },
  { id: "published", label: "Published" },
];

/**
 * Reconciliation Workbench — the operational console for the person who
 * sits with a batch for hours/days: a work queue of every consolidated
 * recon, a per-agent inspector with a verification checklist, exception
 * triage, working notes, and one-click backup/export. Verification
 * progress persists locally per recon.
 */
export function ReconWorkbench({
  rows,
  exceptions,
}: {
  rows: Reconciliation[];
  exceptions: ReconException[];
}) {
  const { module } = useWorkspace();
  const [store, setStore] = React.useState<Store>({});
  const [hydrated, setHydrated] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<QueueFilter>("all");
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  const persist = React.useCallback((next: Store) => {
    setStore(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — keep in-memory state */
    }
  }, []);

  const scoped = React.useMemo(
    () => (module === "all" ? rows : rows.filter((r) => r.module === module)),
    [rows, module]
  );

  const workOf = React.useCallback(
    (id: string): WorkState => store[id] ?? emptyState(),
    [store]
  );

  const queueStatus = React.useCallback(
    (r: Reconciliation): QueueFilter => {
      const w = workOf(r.id).status;
      if (w) return w;
      return r.status === "published" ? "published" : "review";
    },
    [workOf]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((r) => {
      if (filter !== "all" && queueStatus(r) !== filter) return false;
      if (!q) return true;
      return (
        r.agentName.toLowerCase().includes(q) ||
        r.agentId.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [scoped, filter, query, queueStatus]);

  const selected = scoped.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const stats = React.useMemo(() => {
    const open = exceptions.filter(
      (e) => e.status === "open" || e.status === "investigating"
    ).length;
    let verified = 0, flagged = 0, published = 0;
    for (const r of scoped) {
      const s = queueStatus(r);
      if (s === "verified") verified++;
      else if (s === "flagged") flagged++;
      else if (s === "published") published++;
    }
    return { total: scoped.length, review: scoped.length - verified - flagged - published, verified, flagged, published, open };
  }, [scoped, exceptions, queueStatus]);

  function update(id: string, patch: Partial<WorkState>) {
    persist({
      ...store,
      [id]: { ...workOf(id), ...patch, updatedAt: new Date().toISOString() },
    });
  }

  async function download(url: string, fname: string, key: string) {
    setBusy(key);
    try {
      await downloadFromApi(url, fname);
      toast.success("Download started", { description: fname });
    } catch (e) {
      toast.error("Download failed", {
        description: e instanceof Error ? e.message : "Could not generate the file.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendDoc(r: Reconciliation) {
    setBusy(`send-${r.id}`);
    try {
      const res = await fetch("/api/reconciliation/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: r.id, agentId: r.agentId, channels: ["email", "whatsapp"] }),
      });
      const data = await res.json();
      if (data.success) toast.success(`Sent to ${r.agentName}`, { description: data.delivered?.join(" + ") });
      else toast.error("Send failed", { description: data.error });
    } catch {
      toast.error("Send failed");
    } finally {
      setBusy(null);
    }
  }

  async function setExceptionStatus(id: string, status: "resolved" | "investigating") {
    try {
      const res = await fetch(`/api/reconciliation/exceptions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Update failed");
      toast.success(status === "resolved" ? "Exception resolved" : "Marked investigating");
    } catch (e) {
      toast.error("Update failed", { description: e instanceof Error ? e.message : "Try again." });
    }
  }

  const backupUrl =
    `/api/reconciliation/download?agentId=all&format=xlsx` +
    (module !== "all" ? `&module=${encodeURIComponent(module)}` : "");

  return (
    <div className="space-y-4">
      {/* Monitoring strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: "In queue", value: stats.total, icon: ListChecks },
          { label: "Needs review", value: stats.review, icon: CircleDashed },
          { label: "Verified", value: stats.verified, icon: ShieldCheck },
          { label: "Flagged", value: stats.flagged, icon: Flag },
          { label: "Published", value: stats.published, icon: CheckCircle2 },
          { label: "Open alarms", value: stats.open, icon: TriangleAlert },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground uppercase tracking-wide">
              <s.icon className="size-3" aria-hidden /> {s.label}
            </p>
            <p className="tnum mt-0.5 text-[18px] font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agent, ID or recon ref…"
            className="h-9 bg-card pl-8 text-[13px]"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExportButton
            filename="recon-workbench-queue"
            label="Queue"
            data={{
              columns: ["Recon", "Agent", "ID", "Module", "Period", "Closing", "Status", "Work status"],
              rows: filtered.map((r) => [
                r.id, r.agentName, r.agentId, moduleName(r.module), r.period,
                r.closingPosition, r.status, queueStatus(r),
              ]),
            }}
          />
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[13px]"
            disabled={busy === "backup"}
            onClick={() => download(backupUrl, "reconciliation-backup.xlsx", "backup")}
          >
            <Download className="size-4" aria-hidden />
            {busy === "backup" ? "Preparing…" : "Backup batch"}
          </Button>
        </div>
      </div>

      {/* Queue filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-7.5 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Queue + inspector */}
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        {/* Work queue */}
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="max-h-[300px] divide-y overflow-y-auto p-0 lg:max-h-[640px]">
            {filtered.map((r) => {
              const ws = queueStatus(r);
              const open = exceptions.filter(
                (e) => e.agentId === r.agentId && (e.status === "open" || e.status === "investigating")
              ).length;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors ${
                    selected?.id === r.id ? "bg-primary-soft/60" : "hover:bg-surface-hover"
                  }`}
                >
                  <AgentAvatar name={r.agentName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{r.agentName}</span>
                    <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
                      {r.agentId} · {moduleName(r.module)} · {formatPeriod(r.period)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`tnum text-[12px] font-semibold ${r.closingPosition < 0 ? "text-destructive" : ""}`}>
                      {formatMoney(r.closingPosition, r.currency)}
                    </span>
                    <span className="flex items-center gap-1">
                      {open > 0 && (
                        <span className="rounded-full bg-destructive-soft px-1.5 py-px text-[9.5px] font-bold text-destructive">
                          {open}
                        </span>
                      )}
                      <WorkChip status={ws} />
                    </span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted-foreground">Nothing in the queue.</p>
            )}
          </CardContent>
        </Card>

        {/* Inspector */}
        {selected ? (
          <Inspector
            key={selected.id}
            recon={selected}
            work={hydrated ? workOf(selected.id) : emptyState()}
            exceptions={exceptions.filter((e) => e.agentId === selected.agentId)}
            busy={busy}
            onUpdate={(patch) => update(selected.id, patch)}
            onDownload={() =>
              download(
                `/api/reconciliation/download?agentId=${encodeURIComponent(selected.agentId)}&period=${encodeURIComponent(selected.period)}&format=xlsx`,
                `recon-${selected.agentId}-${selected.period}.xlsx`,
                `dl-${selected.id}`
              )
            }
            onSend={() => sendDoc(selected)}
            onException={setExceptionStatus}
            downloading={busy === `dl-${selected.id}`}
            sending={busy === `send-${selected.id}`}
          />
        ) : (
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="py-16 text-center text-[13px] text-muted-foreground">
              Select a reconciliation from the queue to start working.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WorkChip({ status }: { status: QueueFilter }) {
  const map: Record<string, { label: string; cls: string }> = {
    review: { label: "Review", cls: "bg-warning-soft text-warning-foreground" },
    verified: { label: "Verified", cls: "bg-success-soft text-success-foreground" },
    flagged: { label: "Flagged", cls: "bg-destructive-soft text-destructive" },
    published: { label: "Published", cls: "bg-info-soft text-info-foreground" },
  };
  const s = map[status] ?? map.review;
  return (
    <span className={`rounded-full px-1.5 py-px text-[9.5px] font-bold ${s.cls}`}>{s.label}</span>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector — the working surface for one consolidated recon.          */
/* ------------------------------------------------------------------ */

function Inspector({
  recon,
  work,
  exceptions,
  busy,
  downloading,
  sending,
  onUpdate,
  onDownload,
  onSend,
  onException,
}: {
  recon: Reconciliation;
  work: WorkState;
  exceptions: ReconException[];
  busy: string | null;
  downloading: boolean;
  sending: boolean;
  onUpdate: (patch: Partial<WorkState>) => void;
  onDownload: () => void;
  onSend: () => void;
  onException: (id: string, status: "resolved" | "investigating") => void;
}) {
  const expected = recon.insurance + recon.zinara;
  const variance = recon.deposits - expected;
  const doneCount = CHECKLIST.filter((c) => work.checks[c.id]).length;
  const openExceptions = exceptions.filter(
    (e) => e.status === "open" || e.status === "investigating"
  );

  const figures: { label: string; value: number; bold?: boolean; danger?: boolean }[] = [
    { label: "Opening position", value: recon.openingPosition },
    { label: "Insurance", value: recon.insurance },
    { label: "ZINARA", value: recon.zinara },
    { label: "Expected (Ins + ZINARA)", value: expected },
    { label: "Deposits", value: recon.deposits },
    { label: "Adjustments", value: recon.adjustments },
    { label: "Deposit variance", value: variance, danger: variance !== 0 },
    { label: "Closing position", value: recon.closingPosition, bold: true, danger: recon.closingPosition < 0 },
  ];

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="space-y-5 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <AgentAvatar name={recon.agentName} size="sm" />
            <div>
              <p className="text-[15px] font-bold">{recon.agentName}</p>
              <p className="font-mono text-[11.5px] text-muted-foreground">
                {recon.id} · {recon.agentId} · {moduleName(recon.module)} · {formatPeriod(recon.period)} · v{recon.version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={recon.status} />
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]" asChild>
              <Link href={`/app/reconciliation/${recon.id}`}>
                <ExternalLink className="size-3.5" aria-hidden /> Full detail
              </Link>
            </Button>
          </div>
        </div>

        {/* Figures */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {figures.map((f) => (
            <div
              key={f.label}
              className={`rounded-lg border px-3 py-2 ${
                f.danger ? "border-destructive/25 bg-destructive-soft/40" : "bg-muted/40"
              }`}
            >
              <p className="text-[10.5px] text-muted-foreground">{f.label}</p>
              <p className={`tnum text-[14px] ${f.bold ? "font-bold" : "font-semibold"} ${f.danger ? "text-destructive" : ""}`}>
                {formatMoney(f.value, recon.currency)}
              </p>
            </div>
          ))}
        </div>

        {/* Exceptions for this agent */}
        {exceptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Exceptions ({openExceptions.length} open)
            </p>
            {exceptions.map((e) => (
              <div key={e.id} className="rounded-lg border px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-medium">{e.description}</p>
                  <StatusBadge status={e.status} />
                </div>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                  {e.id} · {e.type.replaceAll("_", " ")} · {e.severity}
                </p>
                {(e.status === "open" || e.status === "investigating") && (
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11.5px]" onClick={() => onException(e.id, "resolved")}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" onClick={() => onException(e.id, "investigating")}>
                      Investigate
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Verification checklist */}
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Manual verification — {doneCount}/{CHECKLIST.length}
          </p>
          <div className="space-y-1.5 rounded-lg border p-3">
            {CHECKLIST.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <Checkbox
                  checked={!!work.checks[c.id]}
                  onCheckedChange={(v) =>
                    onUpdate({ checks: { ...work.checks, [c.id]: v === true } })
                  }
                />
                <span className={work.checks[c.id] ? "text-muted-foreground line-through" : ""}>
                  {c.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Working notes */}
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Working notes
          </p>
          <Textarea
            rows={3}
            defaultValue={work.note}
            key={`note-${recon.id}`}
            placeholder="Findings, pending confirmations, follow-ups…"
            className="text-[13px]"
            onBlur={(e) => onUpdate({ note: e.target.value })}
          />
          {work.updatedAt && (
            <p className="text-[10.5px] text-muted-foreground">
              Last worked on {new Date(work.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            size="sm"
            className="h-8.5 gap-1.5 text-[12.5px]"
            disabled={doneCount < CHECKLIST.length}
            title={doneCount < CHECKLIST.length ? "Complete the checklist first" : "Mark this recon verified"}
            onClick={() => {
              onUpdate({ status: "verified" });
              toast.success("Marked verified", { description: recon.agentName });
            }}
          >
            <ShieldCheck className="size-4" aria-hidden /> Mark verified
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8.5 gap-1.5 text-[12.5px] text-warning-foreground"
            onClick={() => {
              onUpdate({ status: "flagged" });
              toast.warning("Flagged for follow-up", { description: recon.agentName });
            }}
          >
            <Flag className="size-4" aria-hidden /> Flag
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 gap-1.5 text-[12.5px]"
              disabled={downloading}
              onClick={onDownload}
            >
              <Download className="size-4" aria-hidden /> {downloading ? "Preparing…" : "XLSX"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 gap-1.5 text-[12.5px]"
              disabled={sending}
              onClick={onSend}
            >
              <Send className="size-4" aria-hidden /> {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
