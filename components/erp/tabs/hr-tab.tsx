"use client";

import * as React from "react";
import {
  Users,
  DollarSign,
  Banknote,
  FileDown,
  Plus,
  Ellipsis,
  LoaderCircle,
} from "lucide-react";
import { downloadPayslip, type Deduction } from "@/lib/erp/payslip";
import { downloadCommissionStatement } from "@/lib/erp/commission-statement";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { ExportButton } from "@/components/shared/export-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { MetricCard } from "../shared";

interface StaffRow {
  id: string;
  name: string;
  role: string;
  dept: string;
  salary: number;
  status: string;
  phone: string;
  email: string;
  loan?: { label: string; amount: number; balance: number };
}
interface AgentRow {
  id: string;
  name: string;
  role: "Agent" | "Assistant";
  commission: number;
  bonus: number;
  status: string;
  phone: string;
  email: string;
  province: string;
  floatAssigned: number;
  floatBalance: number;
  sales: number;
}

export default function HRTab() {
  const [hrSubTab, setHrSubTab] = React.useState<"executive" | "agents" | "records">("executive");
  const [payTarget, setPayTarget] = React.useState<StaffRow | null>(null);

  // Deduction toggles — Super Admin controls which apply.
  const [deductions] = React.useState<Deduction[]>([
    { label: "PAYE", amount: 0.185, statutory: true }, // % of gross (Zimbabwe)
    { label: "NSSA", amount: 0.045, statutory: true },
    { label: "AIDS Levy", amount: 0.03, statutory: true },
  ]);
  const [dedEnabled, setDedEnabled] = React.useState<Record<string, boolean>>({
    PAYE: true, NSSA: true, "AIDS Levy": true,
  });
  const [customDed, setCustomDed] = React.useState<Deduction[]>([]);

  const [executiveStaff, setExecutiveStaff] = React.useState<StaffRow[]>([
    { id: "EMP-001", name: "Munyah Griezmann", role: "CTO", dept: "Executive", salary: 65000, status: "active", phone: "+263 77 123 4567", email: "munyamuzvidziwa19@gmail.com" },
    { id: "EMP-002", name: "Tererai Chiweshe", role: "Chief Operations Officer", dept: "Executive", salary: 48000, status: "active", phone: "+263 77 234 5678", email: "tererai@quickrecon.co.zw" },
    { id: "EMP-003", name: "Rumbi Chiweshe", role: "Chief Financial Officer", dept: "Executive", salary: 45000, status: "active", phone: "+263 77 345 6789", email: "rumbi@quickrecon.co.zw" },
    { id: "EMP-004", name: "Tafadzwa Ncube", role: "Chief Technology Officer", dept: "Executive", salary: 42000, status: "active", phone: "+263 77 456 7890", email: "tafadzwa@quickrecon.co.zw" },
    { id: "EMP-005", name: "Farai Mlambo", role: "Underwriting Manager", dept: "Underwriting", salary: 35000, status: "active", phone: "+263 77 567 8901", email: "farai@quickrecon.co.zw" },
    { id: "EMP-006", name: "Nyasha Dube", role: "Claims Manager", dept: "Claims", salary: 32000, status: "active", phone: "+263 77 678 9012", email: "nyasha@quickrecon.co.zw" },
    { id: "EMP-007", name: "Tariro Moyo", role: "Risk Manager", dept: "Risk", salary: 30000, status: "active", phone: "+263 77 789 0123", email: "tariro@quickrecon.co.zw" },
    { id: "EMP-008", name: "Kudzai Sibanda", role: "Risk Assessor", dept: "Risk", salary: 25000, status: "active", phone: "+263 77 890 1234", email: "kudzai@quickrecon.co.zw" },
    { id: "EMP-009", name: "Chipo Mhondoro", role: "Accountant", dept: "Finance", salary: 28000, status: "active", phone: "+263 77 901 2345", email: "chipo@quickrecon.co.zw" },
    { id: "EMP-010", name: "Tendai Support", role: "Tech Support", dept: "IT", salary: 22000, status: "active", phone: "+263 77 012 3456", email: "tendai@quickrecon.co.zw", loan: { label: "Staff loan", amount: 1200, balance: 8400 } },
    { id: "EMP-011", name: "Rumbi Taruvinga", role: "Clerk", dept: "Operations", salary: 18000, status: "active", phone: "+263 77 123 4567", email: "rumbi.t@quickrecon.co.zw" },
    { id: "EMP-012", name: "Tinashe Kamwendo", role: "Insurer", dept: "Insurance", salary: 24000, status: "on_leave", phone: "+263 77 234 5678", email: "tinashe@quickrecon.co.zw" },
  ]);

  // Agents are independent contractors — commission + bonus, no salary,
  // no department. They manage float, sales and clients.
  const [agents, setAgents] = React.useState<AgentRow[]>([
    { id: "AGT-001", name: "Musa Zhou", role: "Agent", commission: 42800, bonus: 5000, status: "active", phone: "+263 78 111 2222", email: "musa.zhou@quickrecon.co.zw", province: "Harare", floatAssigned: 50000, floatBalance: 8200, sales: 142 },
    { id: "AGT-002", name: "Tendai Moyo", role: "Agent", commission: 39200, bonus: 0, status: "suspended", phone: "+263 78 222 3333", email: "tendai.moyo@quickrecon.co.zw", province: "Bulawayo", floatAssigned: 40000, floatBalance: 12000, sales: 98 },
    { id: "AGT-003", name: "Rumbi Chiweshe", role: "Agent", commission: 30400, bonus: 3200, status: "active", phone: "+263 78 333 4444", email: "rumbi.c@quickrecon.co.zw", province: "Mutare", floatAssigned: 35000, floatBalance: 4300, sales: 76 },
    { id: "AGT-004", name: "Nyanga Dube", role: "Agent", commission: 21600, bonus: 1500, status: "active", phone: "+263 78 444 5555", email: "nyanga.d@quickrecon.co.zw", province: "Gweru", floatAssigned: 30000, floatBalance: 2100, sales: 54 },
    { id: "AGT-005", name: "Farai Mlambo", role: "Agent", commission: 16400, bonus: 2000, status: "active", phone: "+263 78 555 6666", email: "farai.m@quickrecon.co.zw", province: "Masvingo", floatAssigned: 25000, floatBalance: 9800, sales: 41 },
    { id: "AGT-006", name: "Simbarashe Dube", role: "Assistant", commission: 9600, bonus: 0, status: "active", phone: "+263 78 666 7777", email: "simba.d@quickrecon.co.zw", province: "Harare", floatAssigned: 15000, floatBalance: 3200, sales: 28 },
    { id: "AGT-007", name: "Patricia Chirwa", role: "Agent", commission: 35600, bonus: 4500, status: "active", phone: "+263 78 777 8888", email: "patricia.c@quickrecon.co.zw", province: "Mutare", floatAssigned: 45000, floatBalance: 6100, sales: 88 },
    { id: "AGT-008", name: "Blessing Ndlovu", role: "Agent", commission: 0, bonus: 0, status: "inactive", phone: "+263 78 888 9999", email: "blessing.n@quickrecon.co.zw", province: "Bulawayo", floatAssigned: 0, floatBalance: 0, sales: 0 },
  ]);

  // Directory row being edited — shared dialog for staff + agents.
  const [editRow, setEditRow] = React.useState<
    | { kind: "staff"; row: StaffRow }
    | { kind: "agent"; row: AgentRow }
    | null
  >(null);

  function toggleRowStatus(kind: "staff" | "agent", id: string) {
    const flip = (s: string) => (s === "active" ? "suspended" : "active");
    if (kind === "staff") {
      setExecutiveStaff((rows) => rows.map((r) => (r.id === id ? { ...r, status: flip(r.status) } : r)));
    } else {
      setAgents((rows) => rows.map((r) => (r.id === id ? { ...r, status: flip(r.status) } : r)));
    }
    toast.success(`${id} status updated`);
  }

  function deleteRow(kind: "staff" | "agent", id: string) {
    if (kind === "staff") setExecutiveStaff((rows) => rows.filter((r) => r.id !== id));
    else setAgents((rows) => rows.filter((r) => r.id !== id));
    toast.success(`${id} removed`);
  }

  function saveRow(kind: "staff" | "agent", updated: StaffRow | AgentRow) {
    if (kind === "staff") {
      setExecutiveStaff((rows) => rows.map((r) => (r.id === updated.id ? (updated as StaffRow) : r)));
    } else {
      setAgents((rows) => rows.map((r) => (r.id === updated.id ? (updated as AgentRow) : r)));
    }
    toast.success(`${updated.id} updated`);
  }

  const isAgents = hrSubTab === "agents";

  /** Build the active deduction list for a staff member's payslip. */
  function deductionsFor(e: StaffRow): Deduction[] {
    const deds: Deduction[] = deductions
      .filter((d) => dedEnabled[d.label] !== false)
      .map((d) => ({ label: d.label, amount: Math.round(e.salary * d.amount), statutory: d.statutory }));
    for (const c of customDed) {
      if (dedEnabled[c.label] !== false) deds.push({ label: c.label, amount: c.amount });
    }
    return deds;
  }

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
        <button
          onClick={() => setHrSubTab("records")}
          className={`h-8 rounded-full px-4 text-[12.5px] font-medium transition-colors ${hrSubTab === "records" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
        >
          Records
        </button>
      </div>

      {hrSubTab === "records" && (
        <HRRecordsPanel
          staff={[
            ...executiveStaff.map((e) => ({ id: e.id, name: e.name })),
            ...agents.map((a) => ({ id: a.id, name: a.name })),
          ]}
        />
      )}

      {/* Deduction config (staff only) */}
      {hrSubTab === "executive" && (
        <Card className="gap-0 py-0 shadow-xs">
          <CardHeader className="px-4 pt-4 sm:px-5">
            <CardTitle className="text-[14.5px] font-semibold">Payroll Deductions</CardTitle>
            <CardAction>
              <AddDeductionDialog onAdd={(d) => setCustomDed((p) => [...p, d])} />
            </CardAction>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5">
            <div className="flex flex-wrap gap-2">
              {[...deductions, ...customDed].map((d) => (
                <label
                  key={d.label}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]"
                >
                  <input
                    type="checkbox"
                    checked={dedEnabled[d.label] !== false}
                    onChange={(e) => setDedEnabled((p) => ({ ...p, [d.label]: e.target.checked }))}
                    className="accent-primary"
                  />
                  <span className="font-medium">{d.label}</span>
                  {d.statutory && <span className="text-[10.5px] text-muted-foreground">statutory</span>}
                  <span className="tnum text-muted-foreground">
                    {d.amount < 1 ? `${(d.amount * 100).toFixed(1)}%` : formatMoney(d.amount)}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Percentage deductions apply to gross salary. Custom deductions apply per payslip.
            </p>
          </CardContent>
        </Card>
      )}

      {hrSubTab !== "records" && (
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">
            {hrSubTab === "executive" ? "Executive Staff Directory" : "Agents Directory"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="mb-3 flex justify-end">
            <ExportButton
              filename={`hr-${hrSubTab}`}
              rows={isAgents ? agents.length : executiveStaff.length}
              label="Export"
              title={isAgents ? "QuickRecon — Agents Directory" : "QuickRecon — Executive Staff Directory"}
              data={isAgents
                ? {
                    columns: ["ID", "Name", "Role", "Province", "Phone", "Email", "Commission", "Bonus", "Float Assigned", "Float Balance", "Sales", "Status"],
                    rows: agents.map((a) => [a.id, a.name, a.role, a.province, a.phone, a.email, a.commission, a.bonus, a.floatAssigned, a.floatBalance, a.sales, a.status]),
                  }
                : {
                    columns: ["ID", "Name", "Role", "Department", "Phone", "Email", "Salary", "Status"],
                    rows: executiveStaff.map((e) => [e.id, e.name, e.role, e.dept, e.phone, e.email, e.salary, e.status]),
                  }}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Role</th>
                  {isAgents ? (
                    <>
                      <th className="px-3 py-2.5">Province</th>
                      <th className="px-3 py-2.5 text-right">Float</th>
                      <th className="px-3 py-2.5 text-right">Commission</th>
                      <th className="px-3 py-2.5 text-right">Bonus</th>
                      <th className="px-3 py-2.5 text-right">Total Payout</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5 text-right">Salary (ZiG)</th>
                    </>
                  )}
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">{isAgents ? "Report" : "Payslip"}</th>
                  <th className="w-10 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isAgents
                  ? agents.map((a) => (
                      <tr key={a.id} className="hover:bg-surface-hover">
                        <td className="font-mono text-[12px] text-muted-foreground px-3 py-2.5">{a.id}</td>
                        <td className="px-3 py-2.5 font-medium">{a.name}</td>
                        <td className="px-3 py-2.5">{a.role}</td>
                        <td className="px-3 py-2.5">{a.province}</td>
                        <td className="tnum px-3 py-2.5 text-right">{a.floatBalance.toLocaleString()}</td>
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
                            onClick={async () => {
                              try {
                                await downloadCommissionStatement({
                                  agentId: a.id,
                                  agentName: a.name,
                                  province: a.province,
                                  period: "September 2026",
                                  currency: "ZWG",
                                  commission: a.commission,
                                  bonus: a.bonus,
                                  floatBalance: a.floatBalance,
                                });
                                toast.success("Commission report downloaded");
                              } catch (err) {
                                toast.error("Download failed", {
                                  description: err instanceof Error ? err.message : "Could not generate the PDF.",
                                });
                              }
                            }}
                          >
                            <FileDown className="size-3.5" aria-hidden /> Commission
                          </Button>
                        </td>
                        <td className="px-3 py-2.5">
                          <RowActions
                            id={a.id}
                            status={a.status}
                            onEdit={() => setEditRow({ kind: "agent", row: a })}
                            onToggleStatus={() => toggleRowStatus("agent", a.id)}
                            onDelete={() => deleteRow("agent", a.id)}
                          />
                        </td>
                      </tr>
                    ))
                  : executiveStaff.map((e) => (
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
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-[12px]"
                            onClick={() => setPayTarget(e)}
                          >
                            <FileDown className="size-3.5" aria-hidden /> Payslip
                          </Button>
                        </td>
                        <td className="px-3 py-2.5">
                          <RowActions
                            id={e.id}
                            status={e.status}
                            onEdit={() => setEditRow({ kind: "staff", row: e })}
                            onToggleStatus={() => toggleRowStatus("staff", e.id)}
                            onDelete={() => deleteRow("staff", e.id)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Directory row edit dialog */}
      {editRow && (
        <EditRowDialog
          target={editRow}
          onSave={(updated) => saveRow(editRow.kind, updated)}
          onClose={() => setEditRow(null)}
        />
      )}

      {/* Payslip preview dialog — shows real deductions before download */}
      {payTarget && (
        <PayslipDialog
          staff={payTarget}
          deductions={deductionsFor(payTarget)}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

/* ─── HR Records (welfare, leave, loans, sick notes, timecards, banking, KYC) ─── */
interface HrRecord {
  id: string;
  type: "welfare" | "leave" | "loan" | "sick_note" | "timecard" | "banking" | "kyc";
  staff_id: string;
  staff_name: string;
  payload: Record<string, string | number | undefined>;
  status: "pending" | "approved" | "rejected" | "active" | "closed";
  created_at: string;
}

const HR_TYPES: { value: HrRecord["type"]; label: string }[] = [
  { value: "welfare", label: "Welfare" },
  { value: "leave", label: "Leave" },
  { value: "loan", label: "Loan" },
  { value: "sick_note", label: "Sick Note" },
  { value: "timecard", label: "Timecard" },
  { value: "banking", label: "Banking Details" },
  { value: "kyc", label: "KYC" },
];

/** Human-readable summary of a record's payload. */
function hrSummary(r: HrRecord): string {
  const p = r.payload;
  switch (r.type) {
    case "welfare":
      return [p.benefit, p.amount ? formatMoney(Number(p.amount)) : null, p.notes].filter(Boolean).join(" · ");
    case "leave":
      return [p.leaveType, p.from && p.to ? `${p.from} → ${p.to}` : null, p.days ? `${p.days} days` : null, p.reason].filter(Boolean).join(" · ");
    case "loan":
      return [p.amount ? formatMoney(Number(p.amount)) : null, p.installments ? `${p.installments} installments` : null, p.monthly ? `${formatMoney(Number(p.monthly))}/mo` : null, p.reason].filter(Boolean).join(" · ");
    case "sick_note":
      return [p.from && p.to ? `${p.from} → ${p.to}` : null, p.days ? `${p.days} days` : null, p.clinic, p.notes].filter(Boolean).join(" · ");
    case "timecard":
      return [p.date, p.clockIn && p.clockOut ? `${p.clockIn}–${p.clockOut}` : null, p.hours ? `${p.hours}h` : null].filter(Boolean).join(" · ");
    case "banking":
      return [p.bank, p.accountName, p.accountNo ? `Acc ${p.accountNo}` : null, p.branch, p.ecocash].filter(Boolean).join(" · ");
    case "kyc":
      return [p.idNumber ? `ID ${p.idNumber}` : null, p.address, p.nextOfKin ? `NOK: ${p.nextOfKin}` : null, p.nextOfKinPhone].filter(Boolean).join(" · ");
    default:
      return "";
  }
}

function HRRecordsPanel({ staff }: { staff: { id: string; name: string }[] }) {
  const [records, setRecords] = React.useState<HrRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState<"all" | HrRecord["type"]>("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/records");
      if (res.ok) {
        const d = await res.json();
        setRecords(d.records ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const shown = typeFilter === "all" ? records : records.filter((r) => r.type === typeFilter);

  async function setStatus(id: string, status: HrRecord["status"]) {
    const res = await fetch(`/api/hr/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Update failed");
      return;
    }
    toast.success(`Record ${status}`);
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/hr/records/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Delete failed");
      return;
    }
    toast.success("Record deleted");
    load();
  }

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-4 pt-4 sm:px-5">
        <CardTitle className="text-[14.5px] font-semibold">HR Records</CardTitle>
        <CardAction>
          <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden /> New Record
          </Button>
          <ExportButton
            filename="hr-records"
            rows={shown.length}
            label="Export"
            title="QuickRecon — HR Records"
            data={{
              columns: ["ID", "Type", "Staff", "Details", "Status", "Created"],
              rows: shown.map((r) => [r.id, HR_TYPES.find((t) => t.value === r.type)?.label ?? r.type, `${r.staff_name} (${r.staff_id})`, hrSummary(r), r.status, r.created_at.slice(0, 10)]),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5">
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto">
          {([{ value: "all" as const, label: "All" }, ...HR_TYPES]).map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={
                typeFilter === t.value
                  ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                  : "h-8 shrink-0 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-xl border border-dashed py-8 text-center text-[13px] text-muted-foreground">
            No {typeFilter === "all" ? "" : `${HR_TYPES.find((t) => t.value === typeFilter)?.label.toLowerCase()} `}records yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {shown.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3.5">
                <div className="min-w-[200px] flex-1">
                  <p className="text-[13.5px] font-semibold">
                    {HR_TYPES.find((t) => t.value === r.type)?.label} — {r.staff_name}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {r.staff_id} · {hrSummary(r) || "—"} · {formatDate(r.created_at, "dd MMM yyyy")}
                  </p>
                </div>
                <StatusBadge status={r.status} />
                <div className="flex items-center gap-1.5">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-[12px] text-success-foreground" onClick={() => setStatus(r.id, "approved")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-[12px] text-destructive" onClick={() => setStatus(r.id, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Record actions">
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.status !== "active" && (
                        <DropdownMenuItem onSelect={() => setStatus(r.id, "active")}>Mark Active</DropdownMenuItem>
                      )}
                      {r.status !== "closed" && (
                        <DropdownMenuItem onSelect={() => setStatus(r.id, "closed")}>Mark Closed</DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => remove(r.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <HRRecordDialog open={createOpen} onOpenChange={setCreateOpen} staff={staff} onSaved={load} />
    </Card>
  );
}

function HRRecordDialog({
  open,
  onOpenChange,
  staff,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [type, setType] = React.useState<HrRecord["type"]>("leave");
  const [staffId, setStaffId] = React.useState("");
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const FIELD = ({ k, label, type: t = "text", placeholder }: { k: string; label: string; type?: string; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Input type={t} value={fields[k] ?? ""} onChange={set(k)} placeholder={placeholder} className="h-9 bg-card" />
    </div>
  );

  async function submit() {
    if (!staffId) { toast.error("Select a staff member"); return; }
    const member = staff.find((s) => s.id === staffId);
    setSaving(true);
    try {
      const res = await fetch("/api/hr/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          staffId,
          staffName: member?.name ?? staffId,
          payload: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== "")),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast.success("Record saved");
      setFields({});
      setStaffId("");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New HR Record</DialogTitle>
          <DialogDescription>Welfare, leave, loans, sick notes, timecards, banking details and KYC.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Record Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as HrRecord["type"]); setFields({}); }}>
                <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Staff Member <span className="text-destructive">*</span></Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="h-9 bg-card"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "welfare" && (
            <>
              <FIELD k="benefit" label="Benefit" placeholder="e.g. Medical aid, funeral cover" />
              <FIELD k="amount" label="Amount (ZiG)" type="number" />
              <FIELD k="notes" label="Notes" />
            </>
          )}
          {type === "leave" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Leave Type</Label>
                <Select value={fields.leaveType ?? "annual"} onValueChange={(v) => setFields((f) => ({ ...f, leaveType: v }))}>
                  <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="maternity">Maternity / Paternity</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="compassionate">Compassionate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FIELD k="from" label="From" type="date" />
                <FIELD k="to" label="To" type="date" />
                <FIELD k="days" label="Days" type="number" />
              </div>
              <FIELD k="reason" label="Reason" />
            </>
          )}
          {type === "loan" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <FIELD k="amount" label="Amount (ZiG)" type="number" />
                <FIELD k="installments" label="Installments" type="number" />
                <FIELD k="monthly" label="Monthly (ZiG)" type="number" />
              </div>
              <FIELD k="reason" label="Reason" />
            </>
          )}
          {type === "sick_note" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <FIELD k="from" label="From" type="date" />
                <FIELD k="to" label="To" type="date" />
                <FIELD k="days" label="Days" type="number" />
              </div>
              <FIELD k="clinic" label="Clinic / Doctor" />
              <FIELD k="notes" label="Notes" />
            </>
          )}
          {type === "timecard" && (
            <div className="grid grid-cols-2 gap-3">
              <FIELD k="date" label="Date" type="date" />
              <FIELD k="hours" label="Hours" type="number" />
              <FIELD k="clockIn" label="Clock In" type="time" />
              <FIELD k="clockOut" label="Clock Out" type="time" />
            </div>
          )}
          {type === "banking" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FIELD k="bank" label="Bank" placeholder="e.g. CBZ" />
                <FIELD k="branch" label="Branch" />
              </div>
              <FIELD k="accountName" label="Account Name" />
              <div className="grid grid-cols-2 gap-3">
                <FIELD k="accountNo" label="Account Number" />
                <FIELD k="ecocash" label="EcoCash Number" />
              </div>
            </>
          )}
          {type === "kyc" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FIELD k="idNumber" label="National ID" />
                <FIELD k="passport" label="Passport No." />
              </div>
              <FIELD k="address" label="Residential Address" />
              <div className="grid grid-cols-2 gap-3">
                <FIELD k="nextOfKin" label="Next of Kin" />
                <FIELD k="nextOfKinPhone" label="NOK Phone" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            Save Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Super-admin row actions on directory entries. */
function RowActions({
  id,
  status,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  id: string;
  status: string;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${id}`}>
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        {status === "active" ? (
          <DropdownMenuItem onSelect={onToggleStatus}>Suspend</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onToggleStatus}>Activate</DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Edit dialog for HR directory rows — staff and agents share it. */
function EditRowDialog({
  target,
  onSave,
  onClose,
}: {
  target: { kind: "staff"; row: StaffRow } | { kind: "agent"; row: AgentRow };
  onSave: (updated: StaffRow | AgentRow) => void;
  onClose: () => void;
}) {
  const isStaff = target.kind === "staff";
  const [form, setForm] = React.useState<Record<string, string>>(() => {
    const r = target.row;
    const init: Record<string, string> = isStaff
      ? { name: r.name, role: r.role, dept: (r as StaffRow).dept, phone: r.phone, email: r.email, salary: String((r as StaffRow).salary) }
      : { name: r.name, role: r.role, province: (r as AgentRow).province, phone: r.phone, email: r.email, commission: String((r as AgentRow).commission), bonus: String((r as AgentRow).bonus) };
    return init;
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (isStaff) {
      const r = target.row as StaffRow;
      onSave({ ...r, name: form.name.trim(), role: form.role.trim(), dept: form.dept.trim(), phone: form.phone.trim(), email: form.email.trim(), salary: Number(form.salary) || r.salary });
    } else {
      const r = target.row as AgentRow;
      onSave({ ...r, name: form.name.trim(), role: (form.role === "Assistant" ? "Assistant" : "Agent"), province: form.province.trim(), phone: form.phone.trim(), email: form.email.trim(), commission: Number(form.commission) || 0, bonus: Number(form.bonus) || 0 });
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit {isStaff ? "Staff" : "Agent"} — {target.row.id}</DialogTitle>
          <DialogDescription>Update the directory record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input value={form.role} onChange={set("role")} />
          </div>
          {isStaff ? (
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={form.dept} onChange={set("dept")} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Input value={form.province} onChange={set("province")} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
          {isStaff ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Salary (ZiG)</Label>
              <Input type="number" value={form.salary} onChange={set("salary")} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Commission (ZiG)</Label>
                <Input type="number" value={form.commission} onChange={set("commission")} />
              </div>
              <div className="space-y-1.5">
                <Label>Bonus (ZiG)</Label>
                <Input type="number" value={form.bonus} onChange={set("bonus")} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDeductionDialog({ onAdd }: { onAdd: (d: Deduction) => void }) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [isPct, setIsPct] = React.useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]" onClick={() => setOpen(true)}>
        + Add deduction
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Custom deduction</DialogTitle>
            <DialogDescription>Add a deduction that can be toggled per payslip.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Funeral fund" />
            </div>
            <div className="space-y-1.5">
              <Label>{isPct ? "Percentage of gross" : "Fixed amount (ZiG)"}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isPct ? "e.g. 2" : "e.g. 500"} />
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={isPct} onChange={(e) => setIsPct(e.target.checked)} className="accent-primary" />
              Deduct as % of gross salary
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!label.trim() || !amount}
              onClick={() => {
                const v = parseFloat(amount) || 0;
                onAdd({ label: label.trim(), amount: isPct ? v / 100 : v });
                setOpen(false);
                setLabel(""); setAmount("");
                toast.success(`Deduction "${label}" added`);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayslipDialog({
  staff,
  deductions,
  onClose,
}: {
  staff: StaffRow;
  deductions: Deduction[];
  onClose: () => void;
}) {
  const loanAmount = staff.loan?.amount ?? 0;
  const dedTotal = deductions.reduce((s, d) => s + d.amount, 0) + loanAmount;
  const net = staff.salary - dedTotal;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Payslip — {staff.name}</DialogTitle>
          <DialogDescription>September 2026 · {staff.id} · {staff.role}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 text-[13px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Basic salary</span><span className="tnum font-medium">{formatMoney(staff.salary)}</span></div>
          <div className="border-t pt-2">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">Deductions</p>
            {deductions.map((d) => (
              <div key={d.label} className="flex justify-between py-0.5">
                <span>{d.label}{d.statutory && <span className="ml-1 text-[10.5px] text-muted-foreground">(statutory)</span>}</span>
                <span className="tnum text-destructive">({formatMoney(d.amount)})</span>
              </div>
            ))}
            {staff.loan && (
              <div className="flex justify-between py-0.5">
                <span>{staff.loan.label}</span>
                <span className="tnum text-destructive">({formatMoney(staff.loan.amount)})</span>
              </div>
            )}
          </div>
          <div className="flex justify-between border-t pt-2 text-[14px] font-bold">
            <span>Net pay</span>
            <span className="tnum">{formatMoney(net)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            className="gap-1.5"
            onClick={async () => {
              try {
                await downloadPayslip({
                  employeeId: staff.id,
                  employeeName: staff.name,
                  role: staff.role,
                  department: staff.dept,
                  period: "September 2026",
                  currency: "ZWG",
                  basicSalary: staff.salary,
                  deductions,
                  loanRepayment: staff.loan,
                });
                toast.success("Payslip downloaded");
                onClose();
              } catch (err) {
                toast.error("Download failed", {
                  description: err instanceof Error ? err.message : "Could not generate the PDF.",
                });
              }
            }}
          >
            <FileDown className="size-4" aria-hidden /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
