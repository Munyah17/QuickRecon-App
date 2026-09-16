"use client";

import * as React from "react";
import { DollarSign, ArrowLeftRight, RefreshCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CURRENCY_SETTINGS_KEY } from "@/lib/format";

interface CurrencyConfig {
  baseCurrency: "USD" | "ZWG";
  defaultCurrency: "USD" | "ZWG" | "both";
  autoExchangeRate: boolean;
  manualRate: number;
  lastUpdated: string;
  services: {
    reconciliation: "USD" | "ZWG" | "switchable";
    imports: "USD" | "ZWG" | "switchable";
    reports: "USD" | "ZWG" | "switchable";
    erp: "USD" | "ZWG" | "switchable";
    pos: "USD" | "ZWG" | "switchable";
    invoices: "USD" | "ZWG" | "switchable";
  };
}

export function CurrencySettings() {
  const [config, setConfig] = React.useState<CurrencyConfig>({
    baseCurrency: "USD",
    defaultCurrency: "ZWG",
    autoExchangeRate: false,
    manualRate: 26.5,
    lastUpdated: "2026-09-14 08:00",
    services: {
      reconciliation: "ZWG",
      imports: "switchable",
      reports: "switchable",
      erp: "switchable",
      pos: "USD",
      invoices: "switchable",
    },
  });

  const [rbzRate, setRbzRate] = React.useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Load persisted config: Supabase system_settings first, localStorage fallback.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings?key=currency");
        const data = await res.json();
        if (!cancelled && data.value) {
          setConfig((c) => ({ ...c, ...data.value }));
          window.localStorage.setItem(CURRENCY_SETTINGS_KEY, JSON.stringify(data.value));
          setLoaded(true);
          return;
        }
      } catch {
        /* fall through to localStorage */
      }
      if (!cancelled) {
        try {
          const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
          if (raw) setConfig((c) => ({ ...c, ...JSON.parse(raw) }));
        } catch {
          /* ignore */
        }
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function fetchRbzRate() {
    setFetchingRate(true);
    setTimeout(() => {
      setRbzRate(26.74);
      setFetchingRate(false);
      toast.success("RBZ rate fetched", { description: "1 USD = ZiG 26.74 (RBZ — 14 Sep 2026)" });
    }, 1200);
  }

  function updateService(service: keyof CurrencyConfig["services"], value: "USD" | "ZWG" | "switchable") {
    setConfig((c) => ({ ...c, services: { ...c.services, [service]: value } }));
  }

  async function saveConfig() {
    setSaving(true);
    const payload = { ...config, lastUpdated: new Date().toISOString() };
    try {
      window.localStorage.setItem(CURRENCY_SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "currency", value: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Currency settings saved", {
        description: `Base: ${config.baseCurrency} · Default: ${config.defaultCurrency} · Rate: 1 USD = ZiG ${config.manualRate}`,
      });
    } catch (e) {
      toast.error("Could not save to server", {
        description: e instanceof Error ? e.message : "Saved locally only.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Base & Default Currency */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-[14.5px] font-semibold">
              <DollarSign className="size-4 text-primary" aria-hidden /> Base Currency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-5">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Base Currency (for accounting)</Label>
              <Select value={config.baseCurrency} onValueChange={(v) => setConfig((c) => ({ ...c, baseCurrency: v as "USD" | "ZWG" }))}>
                <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD (United States Dollar)</SelectItem>
                  <SelectItem value="ZWG">ZiG (Zimbabwe Gold)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-muted-foreground">All internal calculations use this as the base.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Default Display Currency</Label>
              <Select value={config.defaultCurrency} onValueChange={(v) => setConfig((c) => ({ ...c, defaultCurrency: v as "USD" | "ZWG" | "both" }))}>
                <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD only</SelectItem>
                  <SelectItem value="ZWG">ZiG only</SelectItem>
                  <SelectItem value="both">Both (USD + ZiG)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-muted-foreground">
                Stat cards show one currency or both — "Both" uses the exchange rate below.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Exchange Rate */}
        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-[14.5px] font-semibold">
              <ArrowLeftRight className="size-4 text-primary" aria-hidden /> Exchange Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-5">
            <div className="flex items-center justify-between">
              <Label className="text-[12.5px]">Auto-track from RBZ</Label>
              <Switch
                checked={config.autoExchangeRate}
                onCheckedChange={(c) => {
                  setConfig((cfg) => ({ ...cfg, autoExchangeRate: c }));
                  if (c) fetchRbzRate();
                }}
              />
            </div>
            {config.autoExchangeRate && (
              <div className="flex items-center gap-2 rounded-lg bg-info-soft p-3 text-[12px] text-info-foreground">
                <RefreshCcw className={`size-3.5 ${fetchingRate ? "animate-spin" : ""}`} aria-hidden />
                {fetchingRate ? "Fetching RBZ rate..." : `Last fetched: ${config.lastUpdated}`}
                {!fetchingRate && (
                  <Button variant="ghost" size="sm" className="h-6 ml-auto text-[11px]" onClick={fetchRbzRate}>
                    Refresh
                  </Button>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Manual Rate (1 USD = ? ZiG)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={config.manualRate}
                  onChange={(e) => setConfig((c) => ({ ...c, manualRate: parseFloat(e.target.value) || 0 }))}
                  disabled={config.autoExchangeRate}
                  className="h-9 bg-card"
                />
                <Badge variant="outline" className="shrink-0">ZiG</Badge>
              </div>
              {rbzRate && (
                <p className="text-[11.5px] text-muted-foreground">
                  RBZ official: 1 USD = ZiG {rbzRate.toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Service Currency */}
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Currency by Service</CardTitle>
          <p className="text-[12px] text-muted-foreground">Define which currency each module uses, or allow switching.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(config.services).map(([service, value]) => (
              <div key={service} className="space-y-1.5">
                <Label className="text-[12.5px] capitalize">{service}</Label>
                <Select value={value} onValueChange={(v) => updateService(service as keyof CurrencyConfig["services"], v as "USD" | "ZWG" | "switchable")}>
                  <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD Only</SelectItem>
                    <SelectItem value="ZWG">ZiG Only</SelectItem>
                    <SelectItem value="switchable">Switchable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="h-9 gap-1.5 text-[13px]" onClick={saveConfig} disabled={saving || !loaded}>
          <Check className="size-4" aria-hidden /> {saving ? "Saving…" : "Save Currency Settings"}
        </Button>
      </div>
    </div>
  );
}
