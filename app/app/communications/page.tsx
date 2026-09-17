import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SMSSender } from "@/components/communications/sms-sender";
import { WhatsAppConfig } from "@/components/communications/whatsapp-config";

export const metadata: Metadata = { title: "Communications" };

const HISTORY = [
  { id: "MSG-1", text: "August reports are now available in your portal.", when: "11 Sep 2026, 15:40", scope: "All agents (236)", channel: "Email · WhatsApp" },
  { id: "MSG-2", text: "Reminder: monthly field reports due by the 5th.", when: "03 Sep 2026, 09:00", scope: "All agents (236)", channel: "In-app" },
  { id: "MSG-3", text: "KYC documents outstanding — please upload this week.", when: "28 Aug 2026, 11:12", scope: "Selected agents (41)", channel: "Email" },
];

const TEMPLATES = [
  { id: "T-1", name: "New report available", body: "Dear Agent,\n\nA new reconciliation report for {period} is ready in QuickRecon App.\n\nRegards,\nEnpassent Team" },
  { id: "T-2", name: "Reconciliation published", body: "Dear Agent,\n\nYour {period} reconciliation has been approved and published.\n\nRegards,\nEnpassent Team" },
  { id: "T-3", name: "Assistant approved", body: "Your assistant account for {agent} has been approved and is now active." },
];

export default async function CommunicationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Communications"
        description="Send messages and manage notifications"
        actions={
          <Button className="h-9 gap-1.5 text-[13px]">
            <Plus className="size-4" aria-hidden /> New Message
          </Button>
        }
      />

      <Tabs defaultValue="send">
        <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="send" className="shrink-0 whitespace-nowrap rounded-none px-1 pb-2.5 text-[13px]">Send Message</TabsTrigger>
          <TabsTrigger value="sms" className="shrink-0 whitespace-nowrap rounded-none px-1 pb-2.5 text-[13px]">SMS</TabsTrigger>
          <TabsTrigger value="whatsapp" className="shrink-0 whitespace-nowrap rounded-none px-1 pb-2.5 text-[13px]">WhatsApp</TabsTrigger>
          <TabsTrigger value="history" className="shrink-0 whitespace-nowrap rounded-none px-1 pb-2.5 text-[13px]">Message History</TabsTrigger>
          <TabsTrigger value="templates" className="shrink-0 whitespace-nowrap rounded-none px-1 pb-2.5 text-[13px]">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 py-0 shadow-xs">
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label className="text-[12.5px] font-semibold">Recipients</Label>
                  <RadioGroup defaultValue="all" className="space-y-2">
                    {[
                      ["all", "All Agents (236)"],
                      ["selected", "Selected Agents"],
                      ["single", "Single Agent"],
                      ["module", "Module Group (Enpassent)"],
                    ].map(([v, label]) => (
                      <div key={v} className="flex items-center gap-2.5">
                        <RadioGroupItem value={v} id={`c-${v}`} />
                        <Label htmlFor={`c-${v}`} className="text-[13px] font-normal">{label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-[12.5px] font-semibold">Channel</Label>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2 text-[13px]">
                      <Checkbox defaultChecked /> Email
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <Checkbox defaultChecked /> WhatsApp
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <Checkbox defaultChecked /> In-app
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="msg-template">Message Template</Label>
                  <Select>
                    <SelectTrigger id="msg-template" aria-label="Message template">
                      <SelectValue placeholder="Select a template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-xs">
              <CardContent className="space-y-3 p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="msg-body">Message</Label>
                  <Textarea
                    id="msg-body"
                    rows={8}
                    maxLength={500}
                    placeholder="Type your message here…"
                    className="resize-none text-[13px]"
                  />
                  <p className="text-right text-[11px] text-muted-foreground">0/500</p>
                </div>
                <div className="flex gap-2">
                  <Button className="h-9 gap-1.5 text-[13px]">
                    <Send className="size-4" aria-hidden /> Send Message
                  </Button>
                  <Button variant="outline" className="h-9 text-[13px]">Schedule</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <SMSSender />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {HISTORY.map((h) => (
            <Card key={h.id} className="gap-0 py-0 shadow-xs">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13.5px] font-medium">{h.text}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {h.scope} · {h.channel} · {h.when}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-[12px]">Details</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 grid gap-3 md:grid-cols-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id} className="gap-0 py-0 shadow-xs">
              <CardHeader className="px-4 pt-4">
                <CardTitle className="text-[14px] font-semibold">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <pre className="rounded-lg bg-muted p-3 font-sans text-[12px] whitespace-pre-wrap text-muted-foreground">
                  {t.body}
                </pre>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-[12px]">Use template</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
