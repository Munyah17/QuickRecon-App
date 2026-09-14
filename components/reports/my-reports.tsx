"use client";

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
import { ModuleSelector } from "@/components/shared/module-selector";
import { PeriodSelector } from "@/components/shared/period-selector";
import { formatPeriod } from "@/lib/format";
import type { AgentReport } from "@/types";

/** Agent "My Reports" — mirrors mobile mockup #3, grid cards on desktop. */
export function MyReports({ reports }: { reports: AgentReport[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ModuleSelector allowAll={false} />
        <PeriodSelector />
      </div>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
        {reports.map((r) => {
          const isPdf = r.format === "pdf";
          return (
            <Card key={r.id} className="gap-0 py-0 shadow-xs">
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
                    onClick={() =>
                      toast.success("Download started", { description: `${r.title} (${r.sizeLabel})` })
                    }
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
