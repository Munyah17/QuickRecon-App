"use client";

import * as React from "react";
import {
  Calculator,
  Users,
  ShoppingCart,
  MonitorSmartphone,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Printer,
  RefreshCcw,
  LoaderCircle,
} from "lucide-react";
import { downloadPayslip } from "@/lib/erp/payslip";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { ExportButton } from "@/components/shared/export-button";

export function ERPDashboard() {
  return (
    <Tabs defaultValue="accounting">
      <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="accounting" className="rounded-none px-1 pb-2.5 text-[13px]">Accounting</TabsTrigger>
        <TabsTrigger value="hr" className="rounded-none px-1 pb-2.5 text-[13px]">HR</TabsTrigger>
        <TabsTrigger value="sales" className="rounded-none px-1 pb-2.5 text-[13px]">Sales</TabsTrigger>
        <TabsTrigger value="pos" className="rounded-none px-1 pb-2.5 text-[13px]">POS</TabsTrigger>
        <TabsTrigger value="invoices" className="rounded-none px-1 pb-2.5 text-[13px]">Invoices</TabsTrigger>
      </TabsList>

      <TabsContent value="accounting" className="mt-4">
        <AccountingTab />
      </TabsContent>
      <TabsContent value="hr" className="mt-4">
        <HRTab />
      </TabsContent>
      <TabsContent value="sales" className="mt-4">
        <SalesTab />
      </TabsContent>
      <TabsContent value="pos" className="mt-4">
        <POSTab />
      </TabsContent>
      <TabsContent value="invoices" className="mt-4">
        <InvoicesTab />
      </TabsContent>
    </Tabs>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
          {trend && (
            <span className={`flex items-center gap-1 text-[11.5px] font-medium ${trendUp ? "text-success" : "text-destructive"}`}>
              {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {trend}
            </span>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">{label}</p>
        <p className="tnum text-[20px] font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Accounting ─── */
function AccountingTab() {
  const transactions = [
    { id: "TXN-001", date: "2026-09-01", desc: "Insurance premiums collected", type: "income", amount: 458200 },
    { id: "TXN-002", date: "2026-09-02", desc: "ZINARA fees remitted", type: "expense", amount: 125300 },
    { id: "TXN-003", date: "2026-09-03", desc: "Agent commission — August", type: "expense", amount: 38700 },
    { id: "TXN-004", date: "2026-09-05", desc: "Bank deposit — CBZ", type: "transfer", amount: 320000 },
    { id: "TXN-005", date: "2026-09-07", desc: "Office supplies", type: "expense", amount: 4500 },
    { id: "TXN-006", date: "2026-09-10", desc: "Insurance premiums collected", type: "income", amount: 392100 },
    { id: "TXN-007", date: "2026-09-12", desc: "Fuel reimbursement", type: "expense", amount: 12000 },
    { id: "TXN-008", date: "2026-09-14", desc: "Econet Moovah settlement", type: "income", amount: 187500 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatMoney(1037800)} trend="12.4%" trendUp />
        <MetricCard icon={Banknote} label="Total Expenses" value={formatMoney(180500)} trend="3.2%" trendUp={false} />
        <MetricCard icon={Calculator} label="Net Profit" value={formatMoney(857300)} trend="18.1%" trendUp />
        <MetricCard icon={Receipt} label="Pending Invoices" value="14" />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Txn ID</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Amount (ZiG)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-hover">
                    <td className="font-mono text-[12px] text-muted-foreground px-3 py-2.5">{t.id}</td>
                    <td className="tnum px-3 py-2.5">{t.date}</td>
                    <td className="px-3 py-2.5">{t.desc}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={
                          t.type === "income"
                            ? "border-transparent bg-success-soft text-success-foreground"
                            : t.type === "expense"
                              ? "border-transparent bg-destructive-soft text-destructive"
                              : "border-transparent bg-info-soft text-info-foreground"
                        }
                      >
                        {t.type}
                      </Badge>
                    </td>
                    <td className={`tnum px-3 py-2.5 text-right font-medium ${t.type === "expense" ? "text-destructive" : ""}`}>
                      {t.type === "expense" ? "-" : ""}{t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <ExportButton filename="trial-balance" rows={transactions.length} label="Export Trial Balance" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── HR ─── */
function HRTab() {
  const [hrSubTab, setHrSubTab] = React.useState<"executive" | "agents">("executive");

  const executiveStaff = [
    { id: "EMP-001", name: "Munyah Griezmann", role: "CEO", dept: "Executive", salary: 65000, status: "active", phone: "+263 77 123 4567", email: "munyamuzvidziwa19@gmail.com" },
    { id: "EMP-002", name: "Tererai Chiweshe", role: "Chief Operations Officer", dept: "Executive", salary: 48000, status: "active", phone: "+263 77 234 5678", email: "tererai@quickrecon.co.zw" },
    { id: "EMP-003", name: "Rumbi Chiweshe", role: "Chief Financial Officer", dept: "Executive", salary: 45000, status: "active", phone: "+263 77 345 6789", email: "rumbi@quickrecon.co.zw" },
    { id: "EMP-004", name: "Tafadzwa Ncube", role: "Chief Technology Officer", dept: "Executive", salary: 42000, status: "active", phone: "+263 77 456 7890", email: "tafadzwa@quickrecon.co.zw" },
    { id: "EMP-005", name: "Farai Mlambo", role: "Underwriting Manager", dept: "Underwriting", salary: 35000, status: "active", phone: "+263 77 567 8901", email: "farai@quickrecon.co.zw" },
    { id: "EMP-006", name: "Nyasha Dube", role: "Claims Manager", dept: "Claims", salary: 32000, status: "active", phone: "+263 77 678 9012", email: "nyasha@quickrecon.co.zw" },
    { id: "EMP-007", name: "Tariro Moyo", role: "Risk Manager", dept: "Risk", salary: 30000, status: "active", phone: "+263 77 789 0123", email: "tariro@quickrecon.co.zw" },
    { id: "EMP-008", name: "Kudzai Sibanda", role: "Risk Assessor", dept: "Risk", salary: 25000, status: "active", phone: "+263 77 890 1234", email: "kudzai@quickrecon.co.zw" },
    { id: "EMP-009", name: "Chipo Mhondoro", role: "Accountant", dept: "Finance", salary: 28000, status: "active", phone: "+263 77 901 2345", email: "chipo@quickrecon.co.zw" },
    { id: "EMP-010", name: "Tendai Support", role: "Tech Support", dept: "IT", salary: 22000, status: "active", phone: "+263 77 012 3456", email: "tendai@quickrecon.co.zw" },
    { id: "EMP-011", name: "Rumbi Taruvinga", role: "Clerk", dept: "Operations", salary: 18000, status: "active", phone: "+263 77 123 4567", email: "rumbi.t@quickrecon.co.zw" },
    { id: "EMP-012", name: "Tinashe Kamwendo", role: "Insurer", dept: "Insurance", salary: 24000, status: "on_leave", phone: "+263 77 234 5678", email: "tinashe@quickrecon.co.zw" },
  ];

  // Agents are independent contractors — commission + bonus, no salary.
  const agents = [
    { id: "AGT-001", name: "Musa Zhou", role: "Field Agent", dept: "Field Ops", commission: 42800, bonus: 5000, status: "active", phone: "+263 78 111 2222", email: "musa.zhou@quickrecon.co.zw", province: "Harare" },
    { id: "AGT-002", name: "Tendai Moyo", role: "Field Agent", dept: "Field Ops", commission: 39200, bonus: 0, status: "suspended", phone: "+263 78 222 3333", email: "tendai.moyo@quickrecon.co.zw", province: "Bulawayo" },
    { id: "AGT-003", name: "Rumbi Chiweshe", role: "Field Agent", dept: "Field Ops", commission: 30400, bonus: 3200, status: "active", phone: "+263 78 333 4444", email: "rumbi.c@quickrecon.co.zw", province: "Mutare" },
    { id: "AGT-004", name: "Nyanga Dube", role: "Field Agent", dept: "Field Ops", commission: 21600, bonus: 1500, status: "active", phone: "+263 78 444 5555", email: "nyanga.d@quickrecon.co.zw", province: "Gweru" },
    { id: "AGT-005", name: "Farai Mlambo", role: "Field Agent", dept: "Field Ops", commission: 16400, bonus: 2000, status: "active", phone: "+263 78 555 6666", email: "farai.m@quickrecon.co.zw", province: "Masvingo" },
    { id: "AGT-006", name: "Simbarashe Dube", role: "Assistant", dept: "Field Ops", commission: 9600, bonus: 0, status: "active", phone: "+263 78 666 7777", email: "simba.d@quickrecon.co.zw", province: "Harare" },
    { id: "AGT-007", name: "Patricia Chirwa", role: "Field Agent", dept: "Field Ops", commission: 35600, bonus: 4500, status: "active", phone: "+263 78 777 8888", email: "patricia.c@quickrecon.co.zw", province: "Mutare" },
    { id: "AGT-008", name: "Blessing Ndlovu", role: "Field Agent", dept: "Field Ops", commission: 0, bonus: 0, status: "inactive", phone: "+263 78 888 9999", email: "blessing.n@quickrecon.co.zw", province: "Bulawayo" },
  ];

  const isAgents = hrSubTab === "agents";
  const currentData = isAgents ? agents : executiveStaff;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Users} label="Executive Staff" value={String(executiveStaff.length)} />
        <MetricCard icon={Users} label="Agents" value={String(agents.length)} />
        <MetricCard icon={DollarSign} label="Staff Payroll" value={formatMoney(executiveStaff.reduce((s, e) => s + e.salary, 0))} />
        <MetricCard icon={Banknote} label="Agent Payouts (Comm + Bonus)" value={formatMoney(agents.reduce((s, a) => s + a.commission + a.bonus, 0))} />
      </div>

      {/* Sub-tabs: Executive Staff vs Agents */}
      <div className="inline-flex rounded-full bg-muted p-1">
        <button
          onClick={() => setHrSubTab("executive")}
          className={`h-8 rounded-full px-4 text-[12.5px] font-medium transition-colors ${hrSubTab === "executive" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
        >
          Executive Staff ({executiveStaff.length})
        </button>
        <button
          onClick={() => setHrSubTab("agents")}
          className={`h-8 rounded-full px-4 text-[12.5px] font-medium transition-colors ${hrSubTab === "agents" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
        >
          Agents ({agents.length})
        </button>
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">
            {hrSubTab === "executive" ? "Executive Staff Directory" : "Agents Directory"}
          </CardTitle>
          <CardAction>
            <ExportButton filename={`hr-${hrSubTab}`} rows={currentData.length} label="Export" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Department</th>
                  {isAgents && <th className="px-3 py-2.5">Province</th>}
                  {isAgents ? (
                    <>
                      <th className="px-3 py-2.5 text-right">Commission</th>
                      <th className="px-3 py-2.5 text-right">Bonus</th>
                      <th className="px-3 py-2.5 text-right">Total Payout</th>
                    </>
                  ) : (
                    <th className="px-3 py-2.5 text-right">Salary (ZiG)</th>
                  )}
                  <th className="px-3 py-2.5">Status</th>
                  {isAgents && <th className="px-3 py-2.5 text-right">Payslip</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isAgents
                  ? (currentData as typeof agents).map((a) => (
                      <tr key={a.id} className="hover:bg-surface-hover">
                        <td className="font-mono text-[12px] text-muted-foreground px-3 py-2.5">{a.id}</td>
                        <td className="px-3 py-2.5 font-medium">{a.name}</td>
                        <td className="px-3 py-2.5">{a.role}</td>
                        <td className="px-3 py-2.5">{a.dept}</td>
                        <td className="px-3 py-2.5">{a.province}</td>
                        <td className="tnum px-3 py-2.5 text-right">{a.commission.toLocaleString()}</td>
                        <td className="tnum px-3 py-2.5 text-right">{a.bonus.toLocaleString()}</td>
                        <td className="tnum px-3 py-2.5 text-right font-semibold">{(a.commission + a.bonus).toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={a.status === "active" ? "border-transparent bg-success-soft text-success-foreground" : "border-transparent bg-destructive-soft text-destructive"}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-[12px]"
                            onClick={() =>
                              downloadPayslip({
                                agentId: a.id,
                                agentName: a.name,
                                province: a.province,
                                period: "September 2026",
                                currency: "ZWG",
                                commission: a.commission,
                                bonus: a.bonus,
                              })
                            }
                          >
                            <FileDown className="size-3.5" aria-hidden /> Payslip
                          </Button>
                        </td>
                      </tr>
                    ))
                  : (currentData as typeof executiveStaff).map((e) => (
                      <tr key={e.id} className="hover:bg-surface-hover">
                        <td className="font-mono text-[12px] text-muted-foreground px-3 py-2.5">{e.id}</td>
                        <td className="px-3 py-2.5 font-medium">{e.name}</td>
                        <td className="px-3 py-2.5">{e.role}</td>
                        <td className="px-3 py-2.5">{e.dept}</td>
                        <td className="tnum px-3 py-2.5 text-right">{e.salary.toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={e.status === "active" ? "border-transparent bg-success-soft text-success-foreground" : e.status === "on_leave" ? "border-transparent bg-warning-soft text-warning-foreground" : "border-transparent bg-destructive-soft text-destructive"}>
                            {e.status === "on_leave" ? "On Leave" : e.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sales ─── */
function SalesTab() {
  const salesData = [
    { region: "Harare", agent: "Musa Zhou", policies: 142, revenue: 284000, growth: "+15%" },
    { region: "Bulawayo", agent: "Tendai Moyo", policies: 98, revenue: 196000, growth: "+8%" },
    { region: "Mutare", agent: "Rumbi Chiweshe", policies: 76, revenue: 152000, growth: "+22%" },
    { region: "Gweru", agent: "Nyanga Dube", policies: 54, revenue: 108000, growth: "-3%" },
    { region: "Masvingo", agent: "Farai Mlambo", policies: 41, revenue: 82000, growth: "+11%" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="Total Policies Sold" value="411" trend="12.8%" trendUp />
        <MetricCard icon={DollarSign} label="Total Sales Revenue" value={formatMoney(822000)} trend="18.4%" trendUp />
        <MetricCard icon={TrendingUp} label="Avg Policy Value" value={formatMoney(2000)} />
        <MetricCard icon={Users} label="Active Sales Agents" value="5" />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Sales by Region</CardTitle>
          <CardAction>
            <ExportButton filename="sales-export" rows={salesData.length} label="Export" />
          </CardAction>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Region</th>
                  <th className="px-3 py-2.5">Lead Agent</th>
                  <th className="px-3 py-2.5 text-right">Policies</th>
                  <th className="px-3 py-2.5 text-right">Revenue (ZiG)</th>
                  <th className="px-3 py-2.5 text-right">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {salesData.map((s) => (
                  <tr key={s.region} className="hover:bg-surface-hover">
                    <td className="px-3 py-2.5 font-medium">{s.region}</td>
                    <td className="px-3 py-2.5">{s.agent}</td>
                    <td className="tnum px-3 py-2.5 text-right">{s.policies}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">{s.revenue.toLocaleString()}</td>
                    <td className={`tnum px-3 py-2.5 text-right ${s.growth.startsWith("+") ? "text-success" : "text-destructive"}`}>{s.growth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── POS ─── */
function POSTab() {
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [receiptTerminal, setReceiptTerminal] = React.useState<typeof terminals[0] | null>(null);

  const terminals = [
    { id: "POS-001", location: "Harare CBD", agent: "Musa Zhou", transactions: 342, revenue: 68400, status: "online" },
    { id: "POS-002", location: "Bulawayo", agent: "Tendai Moyo", transactions: 218, revenue: 43600, status: "online" },
    { id: "POS-003", location: "Mutare", agent: "Rumbi Chiweshe", transactions: 156, revenue: 31200, status: "online" },
    { id: "POS-004", location: "Gweru", agent: "Nyanga Dube", transactions: 0, revenue: 0, status: "offline" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={MonitorSmartphone} label="Active Terminals" value="3/4" />
        <MetricCard icon={ShoppingCart} label="Today's Transactions" value="716" trend="9.2%" trendUp />
        <MetricCard icon={DollarSign} label="Today's Revenue" value={formatMoney(143200)} trend="14.7%" trendUp />
        <MetricCard icon={TrendingDown} label="Offline Terminals" value="1" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-semibold">Connected Devices</p>
        <Button className="h-9 gap-1.5 text-[13px]" onClick={() => setConnectOpen(true)}>
          <MonitorSmartphone className="size-4" aria-hidden /> Connect POS Device
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {terminals.map((t) => (
          <Card key={t.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-semibold">{t.id} · {t.location}</p>
                  <p className="text-[12px] text-muted-foreground">Agent: {t.agent}</p>
                </div>
                <Badge variant="outline" className={t.status === "online" ? "border-transparent bg-success-soft text-success-foreground" : "border-transparent bg-muted text-muted-foreground"}>
                  {t.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="tnum text-[16px] font-bold">{t.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue (ZiG)</p>
                  <p className="tnum text-[16px] font-bold">{t.revenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1 text-[12px]"
                  disabled={t.status !== "online"}
                  onClick={() => setReceiptTerminal(t)}
                >
                  <Printer className="size-3.5" aria-hidden /> Print Receipt
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 flex-1 gap-1 text-[12px]"
                  onClick={() => toast.success(`${t.id} synced`, { description: "Latest transactions pulled from device." })}
                >
                  <RefreshCcw className="size-3.5" aria-hidden /> Sync
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConnectPOSDialog open={connectOpen} onOpenChange={setConnectOpen} />
      {receiptTerminal && (
        <ReceiptDialog terminal={receiptTerminal} onClose={() => setReceiptTerminal(null)} />
      )}
    </div>
  );
}

/* POS device connection + receipt printing */
function ConnectPOSDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [terminalId, setTerminalId] = React.useState("");
  const [connectionType, setConnectionType] = React.useState("network");
  const [printerModel, setPrinterModel] = React.useState("");
  const [connecting, setConnecting] = React.useState(false);

  async function connect() {
    if (!terminalId.trim()) {
      toast.error("Terminal ID required");
      return;
    }
    setConnecting(true);
    try {
      // Persist the paired device so it survives reloads.
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "pos_devices",
          value: { id: terminalId.trim(), connectionType, printerModel, pairedAt: new Date().toISOString() },
        }),
      });
      toast.success(`Device ${terminalId} connected`, {
        description: `${connectionType === "network" ? "Network" : "Bluetooth"} pairing successful${printerModel ? ` · printer ${printerModel}` : ""}.`,
      });
      onOpenChange(false);
      setTerminalId(""); setPrinterModel("");
    } catch {
      toast.error("Pairing failed", { description: "Check the terminal ID and try again." });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Connect POS Device</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Pair a card terminal or receipt printer. Network devices pair by terminal ID; Bluetooth devices pair nearby.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos-id">Terminal ID <span className="text-destructive">*</span></Label>
            <Input id="pos-id" placeholder="e.g. POS-005" value={terminalId} onChange={(e) => setTerminalId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Connection</Label>
            <Select value={connectionType} onValueChange={setConnectionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="network">Network / Wi-Fi</SelectItem>
                <SelectItem value="bluetooth">Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-printer">Receipt Printer (optional)</Label>
            <Input id="pos-printer" placeholder="e.g. Epson TM-T20III" value={printerModel} onChange={(e) => setPrinterModel(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connecting}>Cancel</Button>
          <Button onClick={connect} disabled={connecting} className="gap-1.5">
            {connecting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <MonitorSmartphone className="size-4" aria-hidden />}
            {connecting ? "Pairing…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  terminal,
  onClose,
}: {
  terminal: { id: string; location: string; agent: string; transactions: number; revenue: number };
  onClose: () => void;
}) {
  const receiptRef = React.useRef<HTMLDivElement>(null);

  function print() {
    const html = receiptRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${terminal.id}</title>
      <style>
        body{font-family:ui-monospace,monospace;font-size:12px;padding:16px;width:280px;margin:0 auto;color:#000}
        .center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}td{padding:2px 0}
        .r{text-align:right}.bold{font-weight:700}
      </style></head><body>${html}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
    win.document.close();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Terminal Receipt — {terminal.id}</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Preview and print the daily summary receipt for {terminal.location}.
          </DialogDescription>
        </DialogHeader>
        <div ref={receiptRef} className="rounded-lg border bg-card p-4 font-mono text-[12px]">
          <div className="center bold" style={{ textAlign: "center", fontWeight: 700 }}>QuickRecon App</div>
          <div className="center" style={{ textAlign: "center" }}>POS Terminal Summary</div>
          <div className="center" style={{ textAlign: "center" }}>{new Date().toLocaleString()}</div>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%" }}>
            <tbody>
              <tr><td>Terminal</td><td className="r" style={{ textAlign: "right" }}>{terminal.id}</td></tr>
              <tr><td>Location</td><td className="r" style={{ textAlign: "right" }}>{terminal.location}</td></tr>
              <tr><td>Agent</td><td className="r" style={{ textAlign: "right" }}>{terminal.agent}</td></tr>
            </tbody>
          </table>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%" }}>
            <tbody>
              <tr><td>Transactions</td><td className="r" style={{ textAlign: "right" }}>{terminal.transactions}</td></tr>
              <tr className="bold"><td>Revenue (ZiG)</td><td className="r" style={{ textAlign: "right", fontWeight: 700 }}>{terminal.revenue.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div className="center" style={{ textAlign: "center" }}>Thank you</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="gap-1.5" onClick={print}>
            <Printer className="size-4" aria-hidden /> Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Invoices ─── */
function InvoicesTab() {
  const invoices = [
    { id: "INV-2026-001", client: "Econet Wireless", amount: 187500, date: "2026-09-01", due: "2026-09-15", status: "paid" },
    { id: "INV-2026-002", client: "ZINARA Harare", amount: 45200, date: "2026-09-03", due: "2026-09-17", status: "pending" },
    { id: "INV-2026-003", client: "CBZ Bank", amount: 92000, date: "2026-09-05", due: "2026-09-19", status: "pending" },
    { id: "INV-2026-004", client: "Mutare Motors", amount: 18500, date: "2026-09-07", due: "2026-09-21", status: "overdue" },
    { id: "INV-2026-005", client: "Gweru Hardware", amount: 23800, date: "2026-09-10", due: "2026-09-24", status: "pending" },
    { id: "INV-2026-006", client: "Masvingo Traders", amount: 31200, date: "2026-09-12", due: "2026-09-26", status: "paid" },
  ];

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={FileText} label="Total Invoices" value={String(invoices.length)} />
        <MetricCard icon={DollarSign} label="Paid" value={formatMoney(totalPaid)} trend="2 paid" trendUp />
        <MetricCard icon={Receipt} label="Pending" value={formatMoney(totalPending)} />
        <MetricCard icon={TrendingDown} label="Overdue" value={formatMoney(totalOverdue)} />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Invoice List</CardTitle>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <ExportButton filename="invoices-export" rows={invoices.length} label="Export" />
            <Button
              className="h-9 gap-1.5 text-[13px]"
              onClick={() => toast.success("New invoice created", { description: "Invoice draft saved" })}
            >
              <FileText className="size-4" aria-hidden /> New Invoice
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5 text-right">Amount (ZiG)</th>
                  <th className="px-3 py-2.5">Issued</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-hover">
                    <td className="font-mono text-[12px] px-3 py-2.5">{inv.id}</td>
                    <td className="px-3 py-2.5 font-medium">{inv.client}</td>
                    <td className="tnum px-3 py-2.5 text-right">{inv.amount.toLocaleString()}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{inv.date}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{inv.due}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "paid"
                            ? "border-transparent bg-success-soft text-success-foreground"
                            : inv.status === "overdue"
                              ? "border-transparent bg-destructive-soft text-destructive"
                              : "border-transparent bg-warning-soft text-warning-foreground"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
