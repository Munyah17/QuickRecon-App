"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, LoaderCircle, CircleCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Outcome {
  row: number;
  name: string;
  email: string;
  agentId?: string;
  tempPassword?: string;
  ok: boolean;
  error?: string;
}

/**
 * Bulk agent import — uploads an .xlsx/.csv to /api/agents/import and shows
 * per-row results, including generated temp passwords the admin must capture
 * before closing (they are never stored retrievably).
 */
export function ImportAgentsDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    total: number;
    created: number;
    failed: number;
    outcomes: Outcome[];
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const header =
      "Full Name,Email,Phone,Province,Location,National ID,IceCash ID,Modules,Status";
    const sample =
      'Tendai Moyo,tendai.moyo@example.com,+263771234567,Harare,CBD,63-123456A78,ICX-8821,both,pending';
    const blob = new Blob([`${header}\n${sample}\n`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agents-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/agents/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-1.5 text-[13px]">
          <Download className="size-4 rotate-180" aria-hidden /> Import Agents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Import Agents</DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv with one agent per row. Required columns:
            Full Name, Email. Optional: Phone, Province, Location, National ID,
            IceCash ID, Modules, Status.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
            >
              <FileUp className="size-7 text-muted-foreground" aria-hidden />
              <span className="text-[13.5px] font-medium">
                {file ? file.name : "Choose a file or drag it here"}
              </span>
              <span className="text-[12px] text-muted-foreground">
                .xlsx, .xls or .csv — up to 500 rows
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-[12px] font-medium text-primary hover:underline"
            >
              Download CSV template
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-[13px]">
              <span className="font-semibold text-success-foreground">
                {result.created} created
              </span>
              {result.failed > 0 && (
                <span className="font-semibold text-destructive">
                  {" "}· {result.failed} failed
                </span>
              )}
              <span className="text-muted-foreground"> of {result.total} rows</span>
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border p-2">
              {result.outcomes.map((o) => (
                <div
                  key={o.row}
                  className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12.5px]"
                >
                  {o.ok ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden />
                  ) : (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      Row {o.row}: {o.name || "(unnamed)"}{" "}
                      {o.agentId && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {o.agentId}
                        </span>
                      )}
                    </p>
                    {o.ok && o.tempPassword ? (
                      <p className="text-muted-foreground">
                        Temp password:{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                          {o.tempPassword}
                        </code>
                      </p>
                    ) : (
                      o.error && <p className="text-destructive">{o.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {result.created > 0 && (
              <p className="rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                Copy the temp passwords now — they are shown only once.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={runImport} disabled={!file || busy}>
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> Importing…
                </>
              ) : (
                "Import"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
