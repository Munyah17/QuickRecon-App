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

export function ExportButton({
  label = "Export",
  filename = "export",
  rows = 0,
  className,
}: {
  label?: string;
  filename?: string;
  rows?: number;
  className?: string;
}) {
  const handleExport = (format: "pdf" | "excel" | "csv" | "docx") => {
    const formatLabels: Record<string, string> = {
      pdf: "PDF",
      excel: "Excel (XLSX)",
      csv: "CSV",
      docx: "Word (DOCX)",
    };
    toast.success(`Exported as ${formatLabels[format]}`, {
      description: `${rows} records exported to ${filename}.${format === "excel" ? "xlsx" : format}`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`h-9 gap-1.5 text-[13px] ${className ?? ""}`}>
          <Download className="size-4" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
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
