import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, Boxes, Mail, RefreshCcw, FileText, ShieldCheck, History, Save } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const metadata: Metadata = { title: "Settings" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = isCompanyRole(session.user.role);

  if (!company) {
    // Field users land on their profile/settings surface.
    redirect("/app/profile");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Settings"
        description="Configure application settings and preferences"
        actions={
          <Button className="h-9 gap-1.5 text-[13px]">
            <Save className="size-4" aria-hidden /> Save Changes
          </Button>
        }
      />

      <Tabs defaultValue="general">
        <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
          {[
            ["general", "General", Building2],
            ["modules", "Modules", Boxes],
            ["email", "Email & WhatsApp", Mail],
            ["reconciliation", "Reconciliation", RefreshCcw],
            ["templates", "Report Templates", FileText],
            ["security", "Security", ShieldCheck],
            ["audit", "Audit Logs", History],
          ].map(([v, label]) => (
            <TabsTrigger key={v as string} value={v as string} className="shrink-0 rounded-none px-1 pb-2.5 text-[13px]">
              {label as string}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-[14.5px] font-semibold">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Company Name">
                <Input defaultValue="Enpassent (Private) Limited" className="bg-card" />
              </Field>
              <Field label="Reporting Currency">
                <Select defaultValue="ZWG">
                  <SelectTrigger aria-label="Reporting currency" className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZWG">ZiG (ZWG)</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Support Email">
                <Input defaultValue="admin@enpassent.co.zw" className="bg-card" />
              </Field>
              <Field label="Default Reporting Period">
                <Select defaultValue="monthly">
                  <SelectTrigger aria-label="Default reporting period" className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phone Number">
                <Input defaultValue="+263 242 123 456" className="bg-card" />
              </Field>
              <Field label="Time Zone">
                <Select defaultValue="cat">
                  <SelectTrigger aria-label="Time zone" className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cat">(UTC+02:00) Harare, Pretoria</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { name: "Enpassent", desc: "Insurance + ZINARA reconciliation workbooks", agents: 176 },
              { name: "Econet Moovah", desc: "Econet Moovah float & sales reconciliation", agents: 88 },
            ].map((m) => (
              <Card key={m.name} className="gap-0 py-0 shadow-xs">
                <CardContent className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[14.5px] font-semibold">{m.name}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{m.desc}</p>
                    <p className="mt-2 text-[12px] text-muted-foreground">{m.agents} agents assigned</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[12px]">Manage</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-[14.5px] font-semibold">Email (SMTP)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Sender Address"><Input placeholder="reports@enpassent.co.zw" className="bg-card" /></Field>
              <Field label="SMTP Host"><Input placeholder="smtp.example.com" className="bg-card" /></Field>
              <Field label="SMTP Port"><Input placeholder="587" className="bg-card" /></Field>
              <Field label="Security"><Input placeholder="STARTTLS" className="bg-card" /></Field>
            </CardContent>
          </Card>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Credentials are stored as environment variables on the server — never in the browser.
          </p>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-[14.5px] font-semibold">Reconciliation Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Approval Before Publish">
                  <Select defaultValue="required">
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="optional">Optional (auto-publish)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Duplicate Import Detection">
                  <Select defaultValue="hash-period">
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hash-period">Hash + Period</SelectItem>
                      <SelectItem value="hash-only">Checksum only</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Currency Mixing">
                  <Select defaultValue="flag">
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flag">Flag to exceptions</SelectItem>
                      <SelectItem value="reject">Reject import</SelectItem>
                      <SelectItem value="allow">Allow (with warning)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Snapshot on Publish">
                  <Select defaultValue="immutable">
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immutable">Immutable versions</SelectItem>
                      <SelectItem value="editable">Editable versions</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-[13px] font-semibold">Tolerance Thresholds</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Variance Tolerance (ZiG)">
                    <Input type="number" defaultValue={500} className="bg-card" />
                  </Field>
                  <Field label="Variance Tolerance (%)">
                    <Input type="number" defaultValue={2} className="bg-card" />
                  </Field>
                  <Field label="Auto-Flag Threshold (ZiG)">
                    <Input type="number" defaultValue={5000} className="bg-card" />
                  </Field>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-[13px] font-semibold">Auto-Flag Rules</p>
                <div className="space-y-2">
                  {[
                    { label: "Flag when deposits < 90% of collected", defaultChecked: true },
                    { label: "Flag when ZINARA remittance is zero", defaultChecked: true },
                    { label: "Flag when insurance collection is negative", defaultChecked: true },
                    { label: "Flag when closing position differs from previous by > 15%", defaultChecked: false },
                    { label: "Auto-escalate to Super Admin after 3 unresolved exceptions", defaultChecked: true },
                  ].map((r) => (
                    <label key={r.label} className="flex items-center gap-2.5 text-[13px]">
                      <input type="checkbox" defaultChecked={r.defaultChecked} className="size-4 rounded border-border" />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-[13px] font-semibold">Module-Specific Rules</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { module: "Enpassent", rules: "Insurance + ZINARA matching, agent booth validation, monthly period" },
                    { module: "Econet Moovah", rules: "Float tracking, sales reconciliation, daily settlement matching" },
                  ].map((m) => (
                    <div key={m.module} className="rounded-lg border p-3">
                      <p className="text-[13px] font-semibold">{m.module}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{m.rules}</p>
                      <Button variant="outline" size="sm" className="mt-2 h-8 text-[12px]">Configure Rules</Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="space-y-3 p-5 text-[13px]">
              <p className="text-muted-foreground">Report branding and layout used for exports.</p>
              {["Consolidated Report (PDF)", "Detailed Transactions (Excel)", "Commission Summary (PDF)", "ZINARA Report (Excel)"].map((t) => (
                <div key={t} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="font-medium">{t}</span>
                  <Button variant="outline" size="sm" className="text-[12px]">Edit</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="gap-0 py-0 shadow-xs">
            <CardContent className="space-y-3 p-5 text-[13px]">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>Session timeout: <strong>8 hours</strong></p>
                <p>Row Level Security: <strong>Enforced (Supabase)</strong></p>
                <p>Service-role key: <strong>Server-side only</strong></p>
                <p>MFA for company roles: <strong>Available</strong></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditPreview() {
  const events = [
    { id: "AUD-01", action: "Reconciliation published", actor: "Munyah Griezmann", at: "11 Sep 2026, 15:40", detail: "Batch IMP-2608-01 · 236 records" },
    { id: "AUD-02", action: "Agent suspended", actor: "Munyah Griezmann", at: "09 Sep 2026, 10:12", detail: "AGT-000187 (Kudakwashe Ncube)" },
    { id: "AUD-03", action: "Exception resolved", actor: "Taridzo Support", at: "06 Sep 2026, 10:02", detail: "EXC-4004 — ZINARA schema column" },
    { id: "AUD-04", action: "Assistant approved", actor: "Munyah Griezmann", at: "05 Sep 2026, 08:44", detail: "Tairo Moyo → Musa Zhou" },
  ];
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="divide-y p-0">
        {events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 px-5 py-3.5">
            <div className="min-w-[200px] flex-1">
              <p className="text-[13px] font-medium">{e.action}</p>
              <p className="text-[12px] text-muted-foreground">{e.detail}</p>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              <p>{e.actor}</p>
              <p className="tnum">{e.at}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
