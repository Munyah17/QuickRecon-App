"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Play, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useWorkspace } from "@/components/workspace-provider";
import { moduleName } from "@/lib/format";

interface CycleResult {
  module: string;
  period: string;
  status: "done" | "skipped" | "failed";
  reason?: string;
  error?: string;
  batchId?: string;
  documentCount?: number;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Run-cycle + Re-issue controls for the reconciliation toolbar. */
export function ReconRunControls() {
  const router = useRouter();
  const { module } = useWorkspace();
  const [runOpen, setRunOpen] = React.useState(false);
  const [reissueOpen, setReissueOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [reissuing, setReissuing] = React.useState(false);
  const [runModule, setRunModule] = React.useState(module);
  const [period, setPeriod] = React.useState(currentPeriod);

  // Keep the dialog module in step with the workspace selector.
  React.useEffect(() => setRunModule(module), [module]);

  const reportResults = (results: CycleResult[]) => {
    const done = results.filter((r) => r.status === "done");
    const skipped = results.filter((r) => r.status !== "done");
    for (const r of done) {
      toast.success(
        `${moduleName(r.module)} ${r.period}: ${r.documentCount} document${r.documentCount === 1 ? "" : "s"} issued`
      );
    }
    for (const r of skipped) {
      toast.warning(`${moduleName(r.module)} ${r.period}: ${r.reason ?? r.error ?? "skipped"}`);
    }
    return done.length;
  };

  const runCycle = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/reconciliation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: runModule, period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cycle run failed");
      if (reportResults(data.results ?? []) > 0) setRunOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cycle run failed");
    } finally {
      setRunning(false);
    }
  };

  const reissue = async () => {
    setReissuing(true);
    try {
      const res = await fetch("/api/reconciliation/reissue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Re-issue failed");
      if (reportResults(data.combos ?? []) > 0) setReissueOpen(false);
      else
        toast.warning(
          "Nothing could be re-issued — source data was only retained for imports processed after this update. Re-import the workbooks, then re-issue."
        );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-issue failed");
    } finally {
      setReissuing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setRunOpen(true)}
      >
        <CalendarClock className="size-4" aria-hidden /> Run Cycle
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setReissueOpen(true)}
      >
        <RefreshCcw className="size-4" aria-hidden /> Re-Issue
      </Button>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run reconciliation cycle</DialogTitle>
            <DialogDescription>
              Re-runs the engine over the retained source data — no re-upload
              needed. Existing documents for the period are replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select value={runModule} onValueChange={(v) => setRunModule(v as typeof runModule)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  <SelectItem value="enpassent">Enpassent</SelectItem>
                  <SelectItem value="econet-moovah">Moovah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-period">Period</Label>
              <Input
                id="run-period"
                type="month"
                value={period}
                max={currentPeriod()}
                onChange={(e) => setPeriod(e.target.value)}
              />
              <p className="text-[11.5px] text-muted-foreground">
                Covers the 1st of the month through to the present day.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runCycle} disabled={running || !period}>
              <Play className="size-4" aria-hidden /> {running ? "Running…" : "Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reissueOpen} onOpenChange={setReissueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-issue all reconciliation documents?</DialogTitle>
            <DialogDescription>
              Every previously issued document is regenerated from the
              retained source data with the current engine — use this after
              engine or layout fixes to bring historical printouts up to
              date. Periods without retained source data are skipped (re-import
              those workbooks first).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReissueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={reissue} disabled={reissuing}>
              {reissuing ? "Re-issuing…" : "Re-Issue All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
