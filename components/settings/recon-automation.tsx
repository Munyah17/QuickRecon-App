"use client";

import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEY = "recon_auto_monthly";

interface AutoReconConfig {
  enabled: boolean;
  send: boolean;
}

/** Monthly auto-run setting — lives in system_settings.recon_auto_monthly. */
export function ReconAutomationSettings() {
  const [cfg, setCfg] = React.useState<AutoReconConfig>({ enabled: false, send: true });
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/settings?key=${KEY}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.value as Partial<AutoReconConfig> | null;
        if (v) setCfg({ enabled: v.enabled === true, send: v.send !== false });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async (next: AutoReconConfig) => {
    setCfg(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: KEY, value: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Auto-run settings saved");
    } catch {
      toast.error("Could not save auto-run settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-[14.5px] font-semibold">Monthly Auto-Run</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <label className="flex items-start gap-3">
          <Switch
            checked={cfg.enabled}
            disabled={!loaded || saving}
            onCheckedChange={(v) => save({ ...cfg, enabled: v })}
            aria-label="Enable monthly auto-run"
          />
          <span>
            <span className="block text-[13px] font-medium">
              Run a reconciliation cycle automatically every month
            </span>
            <span className="block text-[12px] text-muted-foreground">
              On the 1st of each month, re-runs the engine for the previous
              month (1st → last day) over the retained source data for both
              modules and re-issues all documents.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 pl-1">
          <Checkbox
            checked={cfg.send}
            disabled={!cfg.enabled || !loaded || saving}
            onCheckedChange={(v) => save({ ...cfg, send: v === true })}
            aria-label="Also send documents"
          />
          <span>
            <span className="block text-[13px] font-medium">Also send the documents</span>
            <span className="block text-[12px] text-muted-foreground">
              Emails/WhatsApps each agent their fresh workbook + PDF after the
              monthly run completes.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
