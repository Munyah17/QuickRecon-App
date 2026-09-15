"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Ellipsis, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ModuleSelector } from "@/components/shared/module-selector";
import { PeriodSelector } from "@/components/shared/period-selector";
import { formatDate, formatPeriod, moduleName } from "@/lib/format";
import type { AgentReport, Reconciliation } from "@/types";

/** Agent "My Reports" — card list on mobile, period table on desktop (mockups 4 & 1). */
export function MyReports({
  reports,
  recons,
}: {
  reports: AgentReport[];
  recons: Reconciliation[];
}) {
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const reconById = React.useMemo(
    () => new Map(recons.map((r) => [r.id, r])),
    [recons]
  );

  // One row per module+period (status comes from the linked reconciliation).
  const periodRows = React.useMemo(() => {
    const byKey = new Map<string, { period: string; module: string; submittedAt: string; recon?: Reconciliation }>();
    for (const r of reports) {
      const key = `${r.module}:${r.period}`;
      const existing = byKey.get(key);
      if (!existing || r.submittedAt > existing.submittedAt) {
        byKey.set(key, {
          period: r.period,
          module: r.module,
          submittedAt: r.submittedAt,
          recon: r.reconId ? reconById.get(r.reconId) : undefined,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => b.period.localeCompare(a.period));
  }, [reports, reconById]);

  const filteredRows = periodRows.filter(
    (r) =>
      (moduleFilter === "all" || r.module === moduleFilter) &&
      (statusFilter === "all" || (r.recon?.status ?? "success") === statusFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="lg:hidden">
          <ModuleSelector allowAll={false} />
        </div>
        <div className="lg:hidden">
          <PeriodSelector />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="hidden h-9 w-40 bg-card text-[12.5px] lg:inline-flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="enpassent">Enpassent</SelectItem>
            <SelectItem value="econet-moovah">Econet Moovah</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="hidden h-9 w-36 bg-card text-[12.5px] lg:inline-flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="attention">Attention</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: report cards (mockup 4) */}
      <div className="space-y-3 lg:hidden">
        {reports.map((r) => {
          const isPdf = r.format === "pdf";
          const inner = (
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
                  isPdf
                    ? "bg-destructive-soft text-destructive"
                    : "bg-success-soft text-success-foreground"
                }`}
              >
                {isPdf ? (
                  <FileText className="size-5" aria-hidden />
                ) : (
                  <FileSpreadsheet className="size-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{r.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {formatPeriod(r.period)} · {isPdf ? "PDF" : "Excel"} · {r.sizeLabel}
                </p>
                <button
                  className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.success("Download started", { description: `${r.title} (${r.sizeLabel})` });
                  }}
                >
                  <Download className="size-3.5" aria-hidden /> Download
                </button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Report actions">
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Preview</DropdownMenuItem>
                  <DropdownMenuItem>Download Excel</DropdownMenuItem>
                  <DropdownMenuItem>Download PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          );
          return r.reconId ? (
            <Link key={r.id} href={`/app/reconciliation/${r.reconId}`}>
              <Card className="gap-0 py-0 shadow-xs transition-colors hover:bg-surface-hover">{inner}</Card>
            </Link>
          ) : (
            <Card key={r.id} className="gap-0 py-0 shadow-xs">{inner}</Card>
          );
        })}
      </div>

      {/* Desktop: period table (mockup 1 — My Reports) */}
      <Card className="hidden gap-0 overflow-hidden py-0 shadow-xs lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="w-10 px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Module</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Submitted On</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((r, i) => {
                const status = r.recon?.status ?? "success";
                return (
                  <tr key={`${r.module}-${r.period}`} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      {r.recon ? (
                        <Link href={`/app/reconciliation/${r.recon.id}`} className="hover:text-primary hover:underline">
                          {formatPeriod(r.period)}
                        </Link>
                      ) : (
                        formatPeriod(r.period)
                      )}
                    </td>
                    <td className="px-4 py-3">{moduleName(r.module)}</td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${formatPeriod(r.period)} report`}
                        onClick={() =>
                          toast.success("Download started", {
                            description: `${formatPeriod(r.period)} consolidated report`,
                          })
                        }
                      >
                        <Download className="size-4 text-primary" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    No reports match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">
          Showing {filteredRows.length} of {periodRows.length} reports
        </p>
      </Card>
    </div>
  );
}
