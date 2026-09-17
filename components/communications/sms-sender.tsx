"use client";

import * as React from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function SMSSender() {
  const [recipients, setRecipients] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [includeAgents, setIncludeAgents] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  async function sendSMS() {
    const phones = recipients
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (phones.length === 0 && !includeAgents) {
      toast.error("Enter at least one recipient phone number");
      return;
    }
    if (!message.trim()) {
      toast.error("Enter a message");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: phones,
          includeAgents,
          message: message.trim(),
          senderId: "QuickRecon",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("SMS sent", {
          description: `${data.sent} message${data.sent === 1 ? "" : "s"} sent via Afrosoft`,
        });
        setMessage("");
        setRecipients("");
      } else {
        toast.error("SMS failed", { description: data.error });
      }
    } catch {
      toast.error("SMS failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-[14.5px] font-semibold">
          <MessageSquare className="size-4 text-primary" aria-hidden /> Afrosoft SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Recipients</Label>
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="sms-agents"
              checked={includeAgents}
              onCheckedChange={(c) => setIncludeAgents(c === true)}
            />
            <Label htmlFor="sms-agents" className="text-[13px] font-normal">Send to all agents with phone on record</Label>
          </div>
          <Textarea
            placeholder="Or enter phone numbers separated by commas or new lines…"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            rows={3}
            className="resize-none text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sms-body" className="text-[12.5px]">Message</Label>
          <Textarea
            id="sms-body"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={320}
            placeholder="Type your SMS here…"
            className="resize-none text-[13px]"
          />
          <p className="text-right text-[11px] text-muted-foreground">{message.length}/320</p>
        </div>
        <Button className="h-9 gap-1.5 text-[13px]" onClick={sendSMS} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden /> Send SMS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
