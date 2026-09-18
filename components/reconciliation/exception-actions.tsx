"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Resolve / Investigate / Ignore-with-reason actions for a reconciliation
 * exception. Calls the PATCH route and refreshes the server-rendered list so
 * the new status persists (no simulated notifications).
 */
export function ExceptionActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [ignoreOpen, setIgnoreOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function act(next: "resolved" | "investigating" | "ignored", resolution?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/reconciliation/exceptions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, resolution }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");

      toast.success(
        next === "resolved"
          ? "Marked resolved"
          : next === "ignored"
            ? "Ignored"
            : "Marked investigating"
      );
      setIgnoreOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error("Update failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm" className="h-8 gap-1.5 text-[12px]" disabled={busy}>
            <CheckCircle2 className="size-3.5" aria-hidden /> Resolve
          </Button>
        }
        title="Resolve alarm?"
        description="Mark as resolved after correcting the mapping or variance. The resolution is audit-logged."
        confirmLabel="Resolve"
        onConfirm={() => act("resolved")}
      />

      <Button
        size="sm"
        variant="outline"
        className="h-8 text-[12px]"
        disabled={busy}
        onClick={() => act("investigating")}
      >
        Investigate
      </Button>

      <Dialog open={ignoreOpen} onOpenChange={setIgnoreOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-[12px] text-muted-foreground"
            disabled={busy}
          >
            Ignore with reason…
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[16px]">Ignore alarm?</DialogTitle>
            <DialogDescription className="text-[13px]">
              Ignoring always requires a written reason and is permanent in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for ignoring this exception…"
            rows={3}
            className="text-[13px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() => act("ignored", reason)}
            >
              {busy ? "Ignoring…" : "Ignore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
