import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getExceptions, getImportBatch } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { fileSizeLabel, formatDate, formatPeriod, moduleName } from "@/lib/format";

export const metadata: Metadata = { title: "Import Batch" };

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { batchId } = await params;
  const batch = await getImportBatch(batchId);
  if (!batch) notFound();

  const exceptions = await getExceptions(batch.id);

  return (
    <div className="space-y-4">
      <Link
        href="/app/imports"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Imports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight sm:text-[24px]">{batch.fileName}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            <span className="font-mono">{batch.id}</span> · {moduleName(batch.module)} ·{" "}
            {formatPeriod(batch.period)} · {fileSizeLabel(batch.fileSizeBytes)} · uploaded{" "}
            {formatDate(batch.uploadedAt, "dd MMM yyyy HH:mm")} by {batch.uploadedBy}
          </p>
          <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{batch.checksum}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={batch.status} />
          <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px]">
            <RotateCcw className="size-3.5" aria-hidden /> Reprocess
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-[12.5px] text-destructive">
            <Trash2 className="size-3.5" aria-hidden /> Archive
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="text-[14.5px] font-semibold">Worksheets</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="px-3 py-2.5">Sheet</th>
                    <th className="px-3 py-2.5 text-right">Rows</th>
                    <th className="px-3 py-2.5 text-right">Cols</th>
                    <th className="px-3 py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batch.worksheets.map((w) => (
                    <tr key={w.name}>
                      <td className="px-3 py-2.5 font-medium">{w.name}</td>
                      <td className="tnum px-3 py-2.5 text-right">{w.rowCount.toLocaleString()}</td>
                      <td className="tnum px-3 py-2.5 text-right">{w.columnCount}</td>
                      <td className="px-3 py-2.5 text-[12px] text-warning-foreground">
                        {w.warnings.join("; ") || <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="text-[14.5px] font-semibold">
              Exceptions from this batch ({exceptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 sm:px-5">
            {exceptions.length === 0 && (
              <p className="py-4 text-[13px] text-muted-foreground">No exceptions. Clean import.</p>
            )}
            {exceptions.map((e) => (
              <div key={e.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11.5px] text-muted-foreground">{e.id}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="mt-1 text-[12.5px]">{e.description}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {e.sourceRef} · severity {e.severity}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
