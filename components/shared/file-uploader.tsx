"use client";

import * as React from "react";
import { CloudUpload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fileSizeLabel } from "@/lib/format";

const ACCEPT = ".xlsx,.xls,.csv";

/**
 * Drag & drop workbook picker. Parsing/validation happens server-side;
 * this component only owns selection UX and immediate client hints.
 */
export function FileUploader({
  onFile,
  hint = "Supports .xlsx, .xls, .csv files (Max 1000MB)",
  className,
}: {
  onFile?: (file: File) => void;
  hint?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    onFile?.(f);
  };

  return (
    <div className={className}>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success-foreground">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{file.name}</p>
            <p className="text-[12px] text-muted-foreground">
              {fileSizeLabel(file.size)} · ready to inspect
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove file"
            onClick={() => setFile(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-primary bg-primary-soft/60"
              : "border-border bg-surface-hover/50 hover:border-primary/50 hover:bg-primary-soft/30"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CloudUpload className="size-5.5" aria-hidden />
          </span>
          <span className="text-[14px] font-medium">
            Drag and drop your Excel or CSV file here
            <span className="text-primary"> or click to browse</span>
          </span>
          <span className="text-[12px] text-muted-foreground">{hint}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
