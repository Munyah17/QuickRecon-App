"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploader } from "@/components/shared/file-uploader";
import { cn } from "@/lib/utils";
import { fileSizeLabel, formatPeriod, moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { ModuleCode } from "@/types";

interface InspectedSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  preview: Record<string, unknown>[];
  warnings: string[];
}
interface InspectResult {
  fileName: string;
  fileSizeBytes: number;
  checksum: string;
  worksheets: InspectedSheet[];
  totalRows: number;
}

interface ProcessResult {
  batchId: string;
  stats: { recordsIn: number; recordsNormalised: number; unmatched: number; duplicates: number };
  results: { status: "success" | "warning" | "attention" }[];
  exceptions: { type: string; severity: string; description: string }[];
}

const STEPS = [
  { n: 1, label: "Upload File", sub: "Select workbook" },
  { n: 2, label: "Configure", sub: "Choose sheets & options" },
  { n: 3, label: "Preview", sub: "Validate data" },
  { n: 4, label: "Process", sub: "Import to system" },
] as const;

function monthOptions(count = 6): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // default to last completed month
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function ImportWizard({
  agents = [],
}: {
  agents?: { id: string; fullName: string }[];
}) {
  const { module: workspaceModule } = useWorkspace();
  const [module, setModule] = React.useState<ModuleCode>(
    workspaceModule === "all" ? "enpassent" : workspaceModule
  );
  const [period, setPeriod] = React.useState(monthOptions()[0]);
  const [agentScope, setAgentScope] = React.useState("all");
  const [runValidation, setRunValidation] = React.useState(true);

  const [step, setStep] = React.useState(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [inspecting, setInspecting] = React.useState(false);
  const [inspected, setInspected] = React.useState<InspectResult | null>(null);
  const [selectedSheets, setSelectedSheets] = React.useState<Set<string>>(new Set());
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ProcessResult | null>(null);

  async function inspectAndConfigure() {
    if (!file) return;
    setInspecting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/imports/inspect", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Inspection failed");
      setInspected(body as InspectResult);
      setSelectedSheets(new Set((body as InspectResult).worksheets.map((w) => w.name)));
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not inspect workbook");
    } finally {
      setInspecting(false);
    }
  }

  async function processBatch() {
    if (!file) return;
    setProcessing(true);
    setProgress(15);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 9, 92)), 350);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("module", module);
      form.set("period", period);
      form.set("sheets", Array.from(selectedSheets).join(","));
      form.set("agent", agentScope);
      const res = await fetch("/api/imports/process", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Processing failed");
      clearInterval(timer);
      setProgress(100);
      setResult(body as ProcessResult);
    } catch (e) {
      clearInterval(timer);
      toast.error(e instanceof Error ? e.message : "Processing failed");
      setStep(3);
    } finally {
      setProcessing(false);
    }
  }

  const stageLabel =
    progress < 35
      ? "Reading workbook…"
      : progress < 60
        ? "Normalising records…"
        : progress < 85
          ? "Matching agent identities…"
          : "Staging reconciliation results…";

  return (
    <div className="space-y-4">
      {/* Module segmented toggle (per PC mockup) */}
      <div className="flex justify-center lg:justify-end">
        <div className="inline-flex rounded-full bg-muted p-1">
          {(["enpassent", "econet-moovah"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModule(m)}
              className={cn(
                "h-8 rounded-full px-4 text-[12.5px] font-medium transition-colors",
                module === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              {moduleName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Steps indicator */}
      <ol className="flex items-start justify-between gap-1 sm:gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <li className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[12px] font-bold",
                  step > s.n
                    ? "bg-primary text-primary-foreground"
                    : step === s.n
                      ? "bg-primary text-primary-foreground ring-4 ring-primary-soft"
                      : "border border-border bg-card text-muted-foreground"
                )}
              >
                {step > s.n ? <Check className="size-3.5" aria-hidden /> : s.n}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight font-semibold",
                  step === s.n ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
                <span className="hidden text-[10px] font-normal sm:block">{s.sub}</span>
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <li className="mx-1 mt-3.5 h-px flex-1 bg-border sm:mx-3" aria-hidden />
            )}
          </React.Fragment>
        ))}
      </ol>

      {/* STEP 1 — Upload + options */}
      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4 sm:p-5">
              <FileUploader
                onFile={(f) => setFile(f)}
                hint="Supports .xlsx, .xls, .csv files (Max 1000MB)"
              />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="px-4 pt-4 sm:px-5">
              <CardTitle className="text-[14.5px] font-semibold">Import Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 px-4 pb-4 sm:px-5">
              <div className="space-y-1.5">
                <Label>Reporting Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions().map((p) => (
                      <SelectItem key={p} value={p}>
                        {formatPeriod(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reconciliation Scope</Label>
                <Select value={agentScope} onValueChange={setAgentScope}>
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents — whole group</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fullName} ({a.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Pick one agent to produce that agent&apos;s consolidated document only.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Select Worksheets</Label>
                <Select defaultValue="all" disabled={!inspected}>
                  <SelectTrigger className="h-9 bg-card">
                    <SelectValue placeholder="All worksheets (recommended)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All worksheets (recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2.5 text-[13px]">
                <Checkbox
                  checked={runValidation}
                  onCheckedChange={(c) => setRunValidation(c === true)}
                />
                Run data validation
              </label>
              <div className="flex gap-2.5 rounded-lg bg-info-soft p-3 text-[12px] leading-5 text-info-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  The file will be processed in a staging area first.{" "}
                  <strong>No data will be published until you approve.</strong>
                </p>
              </div>
              <Button
                className="w-full"
                disabled={!file || inspecting}
                onClick={inspectAndConfigure}
              >
                {inspecting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" aria-hidden /> Inspecting workbook…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2 — worksheet configuration */}
      {step === 2 && inspected && (
        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="text-[14.5px] font-semibold">
              Configure worksheets —{" "}
              <span className="font-normal text-muted-foreground">{inspected.fileName}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-5">
            <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-4">
              <span>
                Size: <strong className="text-foreground">{fileSizeLabel(inspected.fileSizeBytes)}</strong>
              </span>
              <span>
                Rows: <strong className="tnum text-foreground">{inspected.totalRows.toLocaleString()}</strong>
              </span>
              <span>
                Checksum: <code className="font-mono text-[11px] text-foreground">{inspected.checksum}</code>
              </span>
              <span>
                Period: <strong className="text-foreground">{formatPeriod(period)}</strong>
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="w-10 px-3 py-2.5"></th>
                    <th className="px-3 py-2.5">Worksheet</th>
                    <th className="px-3 py-2.5 text-right">Rows</th>
                    <th className="px-3 py-2.5 text-right">Columns</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inspected.worksheets.map((w) => (
                    <tr key={w.name} className="hover:bg-surface-hover">
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selectedSheets.has(w.name)}
                          aria-label={`Include ${w.name}`}
                          onCheckedChange={(c) =>
                            setSelectedSheets((prev) => {
                              const next = new Set(prev);
                              if (c === true) next.add(w.name);
                              else next.delete(w.name);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">{w.name}</td>
                      <td className="tnum px-3 py-2.5 text-right">{w.rowCount.toLocaleString()}</td>
                      <td className="tnum px-3 py-2.5 text-right">{w.columnCount}</td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        {w.warnings.length ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-warning-foreground">
                            <TriangleAlert className="size-3.5" aria-hidden />
                            {w.warnings.join("; ")}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                disabled={selectedSheets.size === 0}
                onClick={() => setStep(3)}
              >
                Continue to preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 — preview */}
      {step === 3 && inspected && (
        <div className="space-y-4">
          {inspected.worksheets
            .filter((w) => selectedSheets.has(w.name))
            .map((w) => (
              <Card key={w.name} className="gap-0 py-0 shadow-xs">
                <CardHeader className="px-4 pt-4 sm:px-5">
                  <CardTitle className="flex items-center gap-2 text-[14.5px] font-semibold">
                    <FileSpreadsheet className="size-4 text-primary" aria-hidden />
                    {w.name}
                    <span className="text-[12px] font-normal text-muted-foreground">
                      showing 8 of {w.rowCount.toLocaleString()} rows
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5">
                  {w.warnings.length > 0 && (
                    <div className="mb-3 flex gap-2 rounded-lg bg-warning-soft p-3 text-[12px] text-warning-foreground">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {w.warnings.join(". ")}
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-[12px] whitespace-nowrap">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left font-semibold text-muted-foreground">
                          {w.headers.slice(0, 7).map((h) => (
                            <th key={h} className="px-3 py-2">{h}</th>
                          ))}
                          {w.headers.length > 7 && (
                            <th className="px-3 py-2">+{w.headers.length - 7} more</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {w.preview.map((row, i) => (
                          <tr key={i}>
                            {w.headers.slice(0, 7).map((h) => (
                              <td key={h} className="max-w-[180px] truncate px-3 py-2">
                                {String(row[h] ?? "")}
                              </td>
                            ))}
                            {w.headers.length > 7 && <td className="px-3 py-2 text-muted-foreground">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button disabled={processing} onClick={() => { setStep(4); void processBatch(); }}>
              Process reconciliation
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — process */}
      {step === 4 && (
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-6">
            {!result ? (
              <div className="mx-auto max-w-md space-y-4 py-6 text-center">
                <LoaderCircle className="mx-auto size-8 animate-spin text-primary" aria-hidden />
                <p className="text-[14px] font-semibold">{stageLabel}</p>
                <Progress value={progress} className="h-2" />
                <p className="text-[12px] text-muted-foreground">
                  Staging only — nothing is published without review and approval.
                </p>
              </div>
            ) : (
              <ProcessingSummary result={result} period={period} module={module} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProcessingSummary({
  result,
  period,
  module,
}: {
  result: ProcessResult;
  period: string;
  module: ModuleCode;
}) {
  const counts = result.results.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { success: 0, warning: 0, attention: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-foreground">
          <CircleCheck className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-bold">Import staged successfully</p>
          <p className="text-[12.5px] text-muted-foreground">
            Batch {result.batchId} · {moduleName(module)} · {formatPeriod(period)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Records normalised" value={result.stats.recordsNormalised.toLocaleString()} />
        <SummaryTile label="Reconciled" value={counts.success} tone="success" />
        <SummaryTile label="Warnings" value={counts.warning} tone="warning" />
        <SummaryTile label="Need attention" value={counts.attention + result.exceptions.length} tone="danger" />
      </div>

      {result.exceptions.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft/60 p-4">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-warning-foreground">
            <TriangleAlert className="size-4" aria-hidden />
            {result.exceptions.length} exceptions raised — review before publishing
          </p>
          <ul className="space-y-1 text-[12px] text-warning-foreground/90">
            {result.exceptions.slice(0, 4).map((e, i) => (
              <li key={i}>• {e.description}</li>
            ))}
            {result.exceptions.length > 4 && (
              <li>• …and {result.exceptions.length - 4} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link href="/app/imports">New import</Link>
        </Button>
        <Button asChild>
          <Link href="/app/reconciliation">Review reconciliation results</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tnum mt-1 text-[18px] font-bold tracking-tight",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
