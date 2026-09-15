"use client";

import * as React from "react";
import { Download, FileText, FileSpreadsheet, FileType, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportData, type ExportData, type ExportFormat } from "@/lib/export";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  excel: "Excel (XLSX)",
  csv: "CSV",
  docx: "Word (DOCX)",
};

const EXT: Record<ExportFormat, string> = {
  pdf: "pdf",
  excel: "xlsx",
  csv: "csv",
  docx: "docx",
};

export function ExportButton({
  label = "Export",
  filename = "export",
  rows = 0,
  data,
  title,
  className,
}: {
  label?: string;
  filename?: string;
  /** Row count hint for the toast. */
  rows?: number;
  /** When provided, performs a real file export instead of a notification. */
  data?: ExportData;
  /** Document title inside PDF/DOCX exports. */
  title?: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (data) {
      if (data.rows.length === 0) {
        toast.error("Nothing to export", { description: "The current view has no records." });
        return;
      }
      setBusy(true);
      try {
        await exportData(format, data, filename, title);
        toast.success(`Exported as ${FORMAT_LABELS[format]}`, {
          description: `${data.rows.length} records → ${filename}.${EXT[format]}`,
        });
      } catch {
        toast.error("Export failed", { description: "Could not generate the file." });
      } finally {
        setBusy(false);
      }
      return;
    }
    toast.success(`Exported as ${FORMAT_LABELS[format]}`, {
      description: `${rows} records exported to ${filename}.${EXT[format]}`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy} className={`h-9 gap-1.5 text-[13px] ${className ?? ""}`}>
          <Download className="size-4" aria-hidden />
          <span className="hidden sm:inline">{busy ? "Exporting…" : label}</span>
          <span className="sm:hidden">Export</span>
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handleExport("pdf")} className="gap-2">
          <FileText className="size-4 text-destructive" aria-hidden /> Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("excel")} className="gap-2">
          <FileSpreadsheet className="size-4 text-success" aria-hidden /> Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("csv")} className="gap-2">
          <FileSpreadsheet className="size-4 text-primary" aria-hidden /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("docx")} className="gap-2">
          <FileType className="size-4 text-info-foreground" aria-hidden /> Export as Word (DOCX)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
