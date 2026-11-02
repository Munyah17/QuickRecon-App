"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { fileSizeLabel, formatDate, moduleName } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import type { ImportBatch } from "@/types";

/**
 * Recent import batches, filtered to the active workspace module.
 * The module bubbles under the upload box (and the workspace selector)
 * control which batches are listed.
 */
export function RecentImports({ batches }: { batches: ImportBatch[] }) {
  const { module } = useWorkspace();
  const router = useRouter();
  const [clearing, setClearing] = React.useState(false);
  const visible = module === "all" ? batches : batches.filter((b) => b.module === module);

  /** Wipes prior uploads + run artifacts for the active module scope. */
  const clearHistory = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/imports/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", module }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Clear failed");
      toast.success("Uploads and runs cleared", {
        description: module === "all" ? "All modules" : `${moduleName(module)} only`,
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <CardTitle className="text-[14.5px] font-semibold">
          Recent Imports
          {module !== "all" && (
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              · {moduleName(module)} only
            </span>
          )}
        </CardTitle>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-[12.5px] text-destructive hover:text-destructive"
              disabled={clearing}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {clearing ? "Clearing…" : "Clear history"}
            </Button>
          }
          title="Clear uploads and runs?"
          description={
            <>
              This permanently deletes previous import batches, staged records and
              every reconciliation run, batch, document and report for{" "}
              <strong>{module === "all" ? "all modules" : moduleName(module)}</strong>.
              Agents and their settings are not touched. This cannot be undone.
            </>
          }
          confirmLabel="Clear everything"
          destructive
          onConfirm={clearHistory}
        />
      </CardHeader>
      <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-[12.5px] text-muted-foreground">
            No {module !== "all" ? `${moduleName(module)} ` : ""}imports yet.
          </p>
        ) : (
          visible.map((b) => (
            <Link
              key={b.id}
              href={`/app/imports/${b.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-surface-hover"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-foreground">
                <FileSpreadsheet className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{b.fileName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {fileSizeLabel(b.fileSizeBytes)} · {moduleName(b.module)} ·{" "}
                  {formatDate(b.uploadedAt, "dd MMM yyyy HH:mm")}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
