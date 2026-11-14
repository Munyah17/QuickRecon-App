"use client";

import * as React from "react";
import { toast } from "sonner";
import { LoaderCircle, MessageSquare, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** WhatsApp channel configuration — persisted via /api/settings. */
export function WhatsAppConfig() {
  const [provider, setProvider] = React.useState("whatsapp-cloud");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [businessId, setBusinessId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "whatsapp_config",
          value: { provider, phoneNumberId, businessId },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("WhatsApp config saved", { description: provider });
    } catch {
      toast.error("Could not save config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-4 pt-4 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-[14.5px] font-semibold">
          <MessageSquare className="size-4 text-success" aria-hidden />
          WhatsApp Business Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="max-w-lg space-y-4 px-4 pb-4 sm:px-5">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp-cloud">WhatsApp Cloud API (Meta)</SelectItem>
              <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
              <SelectItem value="360dialog">360dialog</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa-phone">Phone Number ID</Label>
            <Input id="wa-phone" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="e.g. 1094…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-biz">Business Account ID</Label>
            <Input id="wa-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="e.g. 8821…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Access Token</Label>
          <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            The WhatsApp API token is <span className="font-medium text-foreground">not stored in the app</span>.
            When integration keys arrive, set the <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">WHATSAPP_API_KEY</code> environment
            variable on the server. The Phone Number ID above is used as the sender once the token is present.
          </div>
        </div>
        <Button className="h-9 gap-1.5 text-[13px]" onClick={save} disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save configuration
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Status: <span className="font-medium text-foreground">Ready — awaiting integration keys.</span> Sends will report
          &ldquo;WhatsApp provider not configured&rdquo; until <code className="rounded bg-muted px-1 py-0.5 font-mono">WHATSAPP_API_KEY</code> is set.
        </p>
      </CardContent>
    </Card>
  );
}
