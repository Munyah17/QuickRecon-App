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
  const [token, setToken] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "whatsapp_config",
          value: { provider, phoneNumberId, businessId, tokenSet: !!token },
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
          <Label htmlFor="wa-token">Access Token</Label>
          <Input id="wa-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG…" autoComplete="off" />
          <p className="text-[11px] text-muted-foreground">Stored server-side — never exposed to the browser.</p>
        </div>
        <Button className="h-9 gap-1.5 text-[13px]" onClick={save} disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save configuration
        </Button>
      </CardContent>
    </Card>
  );
}
