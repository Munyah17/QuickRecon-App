"use client";

import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
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
  const visible = module === "all" ? batches : batches.filter((b) => b.module === module);

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-4 pt-4 sm:px-5">
        <CardTitle className="text-[14.5px] font-semibold">
          Recent Imports
          {module !== "all" && (
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              · {moduleName(module)} only
            </span>
          )}
        </CardTitle>
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
