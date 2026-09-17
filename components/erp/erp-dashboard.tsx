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
  Plus,
  CloudUpload,
} from "lucide-react";
import { downloadPayslip, type Deduction } from "@/lib/erp/payslip";
import { downloadCommissionStatement } from "@/lib/erp/commission-statement";
import { downloadBusinessDoc, type DocLine } from "@/lib/erp/document-pdf";
import type { Currency } from "@/types";
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
import { formatMoney, formatDate } from "@/lib/format";
import { ExportButton } from "@/components/shared/export-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <p className="tnum text-[17px] font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Accounting ─── */
interface ErpTxn {
  id: string;
  txn_date: string;
  description: string;
  type: "income" | "expense" | "transfer";
  amount: number;
}
interface ErpRequisition {
  id: string;
  title: string;
  requested_by: string;
  department?: string | null;
  amount?: number | null;
  description?: string | null;
  status: "pending" | "approved" | "rejected";
  file_name?: string | null;
  created_at: string;
}

function AccountingTab() {
  const [transactions, setTransactions] = React.useState<ErpTxn[]>([]);
  const [requisitions, setRequisitions] = React.useState<ErpRequisition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [txnDialog, setTxnDialog] = React.useState<null | { mode: "add" } | { mode: "edit"; txn: ErpTxn }>(null);
  const [reqOpen, setReqOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, reqRes] = await Promise.all([
        fetch("/api/erp/transactions"),
        fetch("/api/erp/requisitions"),
      ]);
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions ?? []);
      }
      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequisitions(d.requisitions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const revenue = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const pendingReqs = requisitions.filter((r) => r.status === "pending").length;

  async function deleteTxn(id: string) {
    const res = await fetch(`/api/erp/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Delete failed");
      return;
    }
    toast.success("Transaction deleted");
    load();
  }

  async function reviewReq(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/erp/requisitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Update failed");
      return;
    }
    toast.success(`Requisition ${status}`);
    load();
  }

  async function downloadReqFile(id: string) {
    const res = await fetch(`/api/erp/requisitions/${id}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.url) {
      toast.error(d.error || "No attachment");
      return;
    }
    window.open(d.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatMoney(revenue)} />
        <MetricCard icon={Banknote} label="Total Expenses" value={formatMoney(expenses)} />
        <MetricCard icon={Calculator} label="Net Profit" value={formatMoney(revenue - expenses)} />
        <MetricCard icon={Receipt} label="Pending Requisitions" value={String(pendingReqs)} />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Transactions</CardTitle>
          <CardAction>
            <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => setTxnDialog({ mode: "add" })}>
              <Plus className="size-3.5" aria-hidden /> Add Transaction
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="mb-3 flex justify-end">
            <ExportButton
              filename="trial-balance"
              rows={transactions.length}
              label="Export"
              title="QuickRecon — Transactions"
              data={{
                columns: ["Txn ID", "Date", "Description", "Type", "Amount (ZiG)"],
                rows: transactions.map((t) => [t.id, t.txn_date, t.description, t.type, t.type === "expense" ? -Number(t.amount) : Number(t.amount)]),
              }}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Txn ID</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Amount (ZiG)</th>
                  <th className="w-10 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loading && transactions.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No transactions yet — add the first one.</td></tr>
                )}
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-hover">
                    <td className="font-mono text-[12px] text-muted-foreground px-3 py-2.5">{t.id}</td>
                    <td className="tnum px-3 py-2.5">{t.txn_date}</td>
                    <td className="px-3 py-2.5">{t.description}</td>
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
                      {t.type === "expense" ? "-" : ""}{Number(t.amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Transaction actions">
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setTxnDialog({ mode: "edit", txn: t })}>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => deleteTxn(t.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Requisitions</CardTitle>
          <CardAction>
            <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => setReqOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> New Requisition
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5">
          {!loading && requisitions.length === 0 && (
            <p className="rounded-xl border border-dashed py-8 text-center text-[13px] text-muted-foreground">
              No requisitions yet.
            </p>
          )}
          {requisitions.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3.5">
              <div className="min-w-[180px] flex-1">
                <p className="text-[13.5px] font-semibold">{r.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {r.requested_by}{r.department ? ` · ${r.department}` : ""}
                  {r.amount != null ? ` · ${formatMoney(Number(r.amount))}` : ""}
                  {" · "}{formatDate(r.created_at, "dd MMM yyyy")}
                </p>
              </div>
              {r.file_name && (
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => downloadReqFile(r.id)}>
                  <FileDown className="size-3.5" aria-hidden /> {r.file_name}
                </Button>
              )}
              <StatusBadge status={r.status} />
              {r.status === "pending" && (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 text-[12px] text-success-foreground" onClick={() => reviewReq(r.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-[12px] text-destructive" onClick={() => reviewReq(r.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {txnDialog && (
        <TransactionDialog
          txn={txnDialog.mode === "edit" ? txnDialog.txn : null}
          onClose={() => setTxnDialog(null)}
          onSaved={() => { setTxnDialog(null); load(); }}
        />
      )}
      <RequisitionDialog open={reqOpen} onOpenChange={setReqOpen} onSaved={load} />
    </div>
  );
}

function TransactionDialog({
  txn,
  onClose,
  onSaved,
}: {
  txn: ErpTxn | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = React.useState(txn?.txn_date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState(txn?.description ?? "");
  const [type, setType] = React.useState<string>(txn?.type ?? "expense");
  const [amount, setAmount] = React.useState(txn ? String(txn.amount) : "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!date || !description.trim() || !amount) {
      toast.error("Date, description and amount are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(txn ? `/api/erp/transactions/${txn.id}` : "/api/erp/transactions", {
        method: txn ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, description: description.trim(), type, amount: Number(amount) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast.success(txn ? "Transaction updated" : "Transaction added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{txn ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>Record an income, expense or transfer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="txn-date">Date</Label>
              <Input id="txn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="txn-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-desc">Description</Label>
            <Input id="txn-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Office supplies" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-amount">Amount (ZiG)</Label>
            <Input id="txn-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {txn ? "Save Changes" : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REQ_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp";

function RequisitionDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [requestedBy, setRequestedBy] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function submit() {
    if (!title.trim()) {
      toast.error("Requisition title is required");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      if (requestedBy.trim()) form.set("requestedBy", requestedBy.trim());
      if (department.trim()) form.set("department", department.trim());
      if (amount) form.set("amount", amount);
      if (description.trim()) form.set("description", description.trim());
      if (file) form.set("file", file);
      const res = await fetch("/api/erp/requisitions", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Submit failed");
      toast.success("Requisition submitted");
      setTitle(""); setRequestedBy(""); setDepartment(""); setAmount(""); setDescription(""); setFile(null);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Requisition</DialogTitle>
          <DialogDescription>
            Submit a purchase or expense requisition. Attach a supporting document
            (pdf, docx, xlsx, txt, png, jpeg, jpg, webp — up to 25MB).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-title">Title <span className="text-destructive">*</span></Label>
            <Input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New POS terminals" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-by">Requested By</Label>
              <Input id="req-by" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-dept">Department</Label>
              <Input id="req-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Operations" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-amount">Amount (ZiG)</Label>
            <Input id="req-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-desc">Justification</Label>
            <Textarea id="req-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why is this needed?" />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-[13px] text-muted-foreground hover:border-primary/50 hover:bg-primary-soft/30"
            >
              <CloudUpload className="size-5 text-primary" aria-hidden />
              {file ? file.name : "Tap to attach a document"}
              <span className="text-[11px]">pdf, docx, xlsx, txt, png, jpeg, jpg, webp — up to 25MB</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={REQ_ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            Submit Requisition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── HR ─── */
interface StaffRow {
  id: string; name: string; role: string; dept: string; salary: number;
  status: string; phone: string; email: string;
  loan?: { label: string; amount: number; balance: number };
}
interface AgentRow {
  id: string; name: string; role: "Agent" | "Assistant"; commission: number;
  bonus: number; status: string; phone: string; email: string; province: string;
  floatAssigned: number; floatBalance: number; sales: number;
}

function HRTab() {
  const [hrSubTab, setHrSubTab] = React.useState<"executive" | "agents" | "records">("executive");
  const [payTarget, setPayTarget] = React.useState<StaffRow | null>(null);

  // Deduction toggles — Super Admin controls which apply.
  const [deductions, setDeductions] = React.useState<Deduction[]>([
    { label: "PAYE", amount: 0.185, statutory: true }, // % of gross (Zimbabwe)
    { label: "NSSA", amount: 0.045, statutory: true },
    { label: "AIDS Levy", amount: 0.03, statutory: true },
  ]);
  const [dedEnabled, setDedEnabled] = React.useState<Record<string, boolean>>({
    PAYE: true, NSSA: true, "AIDS Levy": true,
  });
  const [customDed, setCustomDed] = React.useState<Deduction[]>([]);

  const executiveStaff: StaffRow[] = [
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
  ];

  // Agents are independent contractors — commission + bonus, no salary,
  // no department. They manage float, sales and clients.
  const agents: AgentRow[] = [
    { id: "AGT-001", name: "Musa Zhou", role: "Agent", commission: 42800, bonus: 5000, status: "active", phone: "+263 78 111 2222", email: "musa.zhou@quickrecon.co.zw", province: "Harare", floatAssigned: 50000, floatBalance: 8200, sales: 142 },
    { id: "AGT-002", name: "Tendai Moyo", role: "Agent", commission: 39200, bonus: 0, status: "suspended", phone: "+263 78 222 3333", email: "tendai.moyo@quickrecon.co.zw", province: "Bulawayo", floatAssigned: 40000, floatBalance: 12000, sales: 98 },
    { id: "AGT-003", name: "Rumbi Chiweshe", role: "Agent", commission: 30400, bonus: 3200, status: "active", phone: "+263 78 333 4444", email: "rumbi.c@quickrecon.co.zw", province: "Mutare", floatAssigned: 35000, floatBalance: 4300, sales: 76 },
    { id: "AGT-004", name: "Nyanga Dube", role: "Agent", commission: 21600, bonus: 1500, status: "active", phone: "+263 78 444 5555", email: "nyanga.d@quickrecon.co.zw", province: "Gweru", floatAssigned: 30000, floatBalance: 2100, sales: 54 },
    { id: "AGT-005", name: "Farai Mlambo", role: "Agent", commission: 16400, bonus: 2000, status: "active", phone: "+263 78 555 6666", email: "farai.m@quickrecon.co.zw", province: "Masvingo", floatAssigned: 25000, floatBalance: 9800, sales: 41 },
    { id: "AGT-006", name: "Simbarashe Dube", role: "Assistant", commission: 9600, bonus: 0, status: "active", phone: "+263 78 666 7777", email: "simba.d@quickrecon.co.zw", province: "Harare", floatAssigned: 15000, floatBalance: 3200, sales: 28 },
    { id: "AGT-007", name: "Patricia Chirwa", role: "Agent", commission: 35600, bonus: 4500, status: "active", phone: "+263 78 777 8888", email: "patricia.c@quickrecon.co.zw", province: "Mutare", floatAssigned: 45000, floatBalance: 6100, sales: 88 },
    { id: "AGT-008", name: "Blessing Ndlovu", role: "Agent", commission: 0, bonus: 0, status: "inactive", phone: "+263 78 888 9999", email: "blessing.n@quickrecon.co.zw", province: "Bulawayo", floatAssigned: 0, floatBalance: 0, sales: 0 },
  ];

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
          <CardAction>
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
                            onClick={() =>
                              downloadCommissionStatement({
                                agentId: a.id,
                                agentName: a.name,
                                province: a.province,
                                period: "September 2026",
                                currency: "ZWG",
                                commission: a.commission,
                                bonus: a.bonus,
                                floatBalance: a.floatBalance,
                              })
                            }
                          >
                            <FileDown className="size-3.5" aria-hidden /> Commission
                          </Button>
                        </td>
                        <td className="px-3 py-2.5"><RowActions id={a.id} status={a.status} /></td>
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
                        <td className="px-3 py-2.5"><RowActions id={e.id} status={e.status} /></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
function RowActions({ id, status }: { id: string; status: string }) {
  const act = (action: string, destructive = false) =>
    toast[destructive ? "error" : "success"](`${action} ${id}`, { description: `Change persisted via /api/users.` });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${id}`}>
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => act("Editing")}>Edit</DropdownMenuItem>
        {status === "active" ? (
          <DropdownMenuItem onSelect={() => act("Suspended")}>Suspend</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => act("Activated")}>Activate</DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => act("Deleted", true)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
            <ExportButton
              filename="sales-export"
              rows={salesData.length}
              label="Export"
              title="QuickRecon — Sales by Region"
              data={{
                columns: ["Region", "Lead Agent", "Policies", "Revenue (ZiG)", "Growth"],
                rows: salesData.map((s) => [s.region, s.agent, s.policies, s.revenue, s.growth]),
              }}
            />
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
  const [remitTerminal, setRemitTerminal] = React.useState<typeof terminals[0] | null>(null);
  const [gateway, setGateway] = React.useState("paynow");
  const [bankAccount, setBankAccount] = React.useState("CBZ ****4521 (Enpassent Ops)");

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

      {/* Payment gateway + company account — where remitted float lands */}
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Payment Gateway</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Gateway provider</Label>
              <Select value={gateway} onValueChange={setGateway}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paynow">Paynow (Zimbabwe)</SelectItem>
                  <SelectItem value="ecocash">EcoCash Merchant</SelectItem>
                  <SelectItem value="onemoney">OneMoney</SelectItem>
                  <SelectItem value="innbucks">InnBucks</SelectItem>
                  <SelectItem value="zimswitch">ZimSwitch</SelectItem>
                  <SelectItem value="stripe">Stripe (international)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Settlement account (float lands here)</Label>
              <Select value={bankAccount} onValueChange={setBankAccount}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBZ ****4521 (Enpassent Ops)">CBZ ****4521 (Enpassent Ops)</SelectItem>
                  <SelectItem value="Stanbic ****8830 (Enpassent Float)">Stanbic ****8830 (Enpassent Float)</SelectItem>
                  <SelectItem value="CABS ****2217 (Enpassent Reserves)">CABS ****2217 (Enpassent Reserves)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Agents swipe on portable terminals to remit float — funds settle to this account via the selected gateway. Super Admin can change providers in Settings.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={async () => {
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: "pos_gateway", value: { provider: gateway, settlementAccount: bankAccount } }),
                });
                toast.success("Gateway saved", { description: `${gateway} → ${bankAccount}` });
              }}
            >
              Save gateway config
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  <Printer className="size-3.5" aria-hidden /> Receipt
                </Button>
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1 text-[12px]"
                  disabled={t.status !== "online"}
                  onClick={() => setRemitTerminal(t)}
                >
                  <Banknote className="size-3.5" aria-hidden /> Remit Float
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-[12px]"
                  onClick={() => toast.success(`${t.id} synced`, { description: "Latest transactions pulled from device." })}
                >
                  <RefreshCcw className="size-3.5" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConnectPOSDialog open={connectOpen} onOpenChange={setConnectOpen} gateway={gateway} settlement={bankAccount} />
      {receiptTerminal && (
        <ReceiptDialog terminal={receiptTerminal} onClose={() => setReceiptTerminal(null)} />
      )}
      {remitTerminal && (
        <RemitFloatDialog terminal={remitTerminal} gateway={gateway} settlement={bankAccount} onClose={() => setRemitTerminal(null)} />
      )}
    </div>
  );
}

/* POS device connection — portable terminal + gateway config */
function ConnectPOSDialog({
  open,
  onOpenChange,
  gateway,
  settlement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gateway: string;
  settlement: string;
}) {
  const [terminalId, setTerminalId] = React.useState("");
  const [connectionType, setConnectionType] = React.useState("network");
  const [deviceKind, setDeviceKind] = React.useState("android");
  const [printerModel, setPrinterModel] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [connecting, setConnecting] = React.useState(false);

  async function connect() {
    if (!terminalId.trim()) {
      toast.error("Terminal ID required");
      return;
    }
    setConnecting(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "pos_devices",
          value: {
            id: terminalId.trim(), deviceKind, connectionType, printerModel,
            location, gateway, settlementAccount: settlement,
            pairedAt: new Date().toISOString(),
          },
        }),
      });
      toast.success(`Device ${terminalId} connected`, {
        description: `${connectionType} · ${deviceKind} terminal${printerModel ? ` · printer ${printerModel}` : ""}`,
      });
      onOpenChange(false);
      setTerminalId(""); setPrinterModel(""); setLocation("");
    } catch {
      toast.error("Pairing failed", { description: "Check the terminal ID and try again." });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Connect POS Device</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Pair a portable POS terminal. Supports Android terminals, web-based POS apps and dedicated hardware.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pos-id">Terminal ID <span className="text-destructive">*</span></Label>
              <Input id="pos-id" placeholder="e.g. POS-005" value={terminalId} onChange={(e) => setTerminalId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-loc">Location</Label>
              <Input id="pos-loc" placeholder="e.g. Harare CBD" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Device type</Label>
              <Select value={deviceKind} onValueChange={setDeviceKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="android">Android terminal</SelectItem>
                  <SelectItem value="web">Web / browser POS</SelectItem>
                  <SelectItem value="hardware">Hardware terminal</SelectItem>
                  <SelectItem value="mobile">Mobile app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Connection</Label>
              <Select value={connectionType} onValueChange={setConnectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">Network / Wi-Fi</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="usb">USB tethered</SelectItem>
                  <SelectItem value="4g">4G / LTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-printer">Receipt printer (optional)</Label>
            <Input id="pos-printer" placeholder="e.g. Epson TM-T20III" value={printerModel} onChange={(e) => setPrinterModel(e.target.value)} />
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
            Gateway: <strong className="text-foreground">{gateway}</strong> · Settles to {settlement}
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

/* Agent float remittance — swipe on terminal → funds to company account */
function RemitFloatDialog({
  terminal,
  gateway,
  settlement,
  onClose,
}: {
  terminal: { id: string; location: string; agent: string; transactions: number; revenue: number };
  gateway: string;
  settlement: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function remit() {
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setProcessing(true);
    try {
      await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "float_remittance",
          title: `Float remittance — ${terminal.id}`,
          description: `${terminal.agent} remitted ${formatMoney(v)} via ${gateway} → ${settlement}`,
          amount: v,
        }),
      });
      setDone(true);
      toast.success("Remittance recorded", { description: `${formatMoney(v)} → ${settlement}` });
    } catch {
      toast.error("Remittance failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remit Float — {terminal.id}</DialogTitle>
          <DialogDescription>
            Agent swipes on the terminal; funds settle to the company account via {gateway}.
          </DialogDescription>
        </DialogHeader>
        {!done ? (
          <div className="space-y-3.5 py-2">
            <div className="rounded-lg border p-3 text-[12.5px]">
              <p className="font-medium">{terminal.agent}</p>
              <p className="text-muted-foreground">{terminal.location}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount to remit (ZiG)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
              Settles to: <strong className="text-foreground">{settlement}</strong>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[15px] font-semibold text-success">Remittance recorded</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{formatMoney(parseFloat(amount) || 0)} → {settlement}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{done ? "Close" : "Cancel"}</Button>
          {!done && (
            <Button onClick={remit} disabled={processing}>
              {processing ? "Processing…" : "Remit now"}
            </Button>
          )}
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

/* ─── Invoices & Quotations ─── */
interface BizDocRow {
  id: string;
  kind: "invoice" | "quotation";
  client: string;
  clientContact?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  poNumber?: string;
  amount: number;
  date: string;
  due?: string;
  validUntil?: string;
  status: "paid" | "pending" | "overdue" | "draft" | "accepted" | "declined";
  lines: DocLine[];
  currency: Currency;
  discountPct?: number;
  vatRate?: number;
  amountPaid?: number;
  notes?: string;
}

function InvoicesTab() {
  const [docs, setDocs] = React.useState<BizDocRow[]>([
    { id: "INV-2026-001", kind: "invoice", client: "Econet Wireless", clientContact: "T. Makoni", clientAddress: "Econet Park, Borrowdale, Harare", clientEmail: "accounts@econet.co.zw", clientPhone: "+263 77 222 0000", poNumber: "PO-ECO-4471", amount: 187500, date: "2026-09-01", due: "2026-09-15", status: "paid", vatRate: 0.155, amountPaid: 187500, notes: "Settlement via RTGS — reference INV-2026-001.", lines: [{ code: "SVC-REC", description: "Reconciliation services — August 2026", qty: 1, unit: "svc", unitPrice: 187500 }], currency: "ZWG" },
    { id: "INV-2026-002", kind: "invoice", client: "ZINARA Harare", clientContact: "Procurement Dept", clientAddress: "Runhare House, Harare", clientEmail: "procurement@zinara.co.zw", amount: 45200, date: "2026-09-03", due: "2026-09-17", status: "pending", vatRate: 0.155, lines: [{ code: "MOD-ZIN", description: "ZINARA reconciliation module", qty: 1, unit: "svc", unitPrice: 45200 }], currency: "ZWG" },
    { id: "INV-2026-003", kind: "invoice", client: "CBZ Bank", clientEmail: "vendor.payables@cbz.co.zw", amount: 92000, date: "2026-09-05", due: "2026-09-19", status: "pending", vatRate: 0.155, lines: [{ code: "SVC-AGT", description: "Agent network reconciliation", qty: 1, unit: "svc", unitPrice: 92000 }], currency: "ZWG" },
    { id: "INV-2026-004", kind: "invoice", client: "Mutare Motors", clientPhone: "+263 20 64 321", amount: 18500, date: "2026-09-07", due: "2026-09-21", status: "overdue", vatRate: 0.155, notes: "Second reminder sent 2026-09-22.", lines: [{ description: "Monthly reconciliation", qty: 1, unit: "mo", unitPrice: 18500 }], currency: "ZWG" },
    { id: "QT-2026-001", kind: "quotation", client: "Bulawayo Insurers", clientContact: "R. Nkomo", clientEmail: "rnkomo@byo-insurers.co.zw", amount: 64000, date: "2026-09-10", validUntil: "2026-09-30", status: "pending", vatRate: 0.155, discountPct: 5, notes: "Includes onboarding of 12 agents.", lines: [{ code: "SETUP-Q4", description: "Q4 reconciliation setup", qty: 1, unit: "svc", unitPrice: 64000 }], currency: "ZWG" },
  ]);
  const [createOpen, setCreateOpen] = React.useState<"invoice" | "quotation" | null>(null);
  const [docTab, setDocTab] = React.useState<"invoice" | "quotation">("invoice");

  const invoices = docs.filter((d) => d.kind === "invoice");
  const quotes = docs.filter((d) => d.kind === "quotation");
  const shown = docTab === "invoice" ? invoices : quotes;

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  async function downloadDoc(d: BizDocRow) {
    try {
      await downloadBusinessDoc({
        kind: d.kind,
        number: d.id,
        status: d.status,
        client: d.client,
        clientContact: d.clientContact,
        clientAddress: d.clientAddress,
        clientEmail: d.clientEmail,
        clientPhone: d.clientPhone,
        poNumber: d.poNumber,
        issueDate: d.date,
        dueDate: d.due,
        validUntil: d.validUntil,
        currency: d.currency,
        lines: d.lines,
        discountPct: d.discountPct,
        vatRate: d.vatRate ?? 0.155,
        amountPaid: d.amountPaid,
        notes: d.notes,
      });
      toast.success(`${d.kind === "invoice" ? "Invoice" : "Quotation"} downloaded`, { description: `${d.id}.pdf` });
    } catch (err) {
      toast.error("Download failed", { description: err instanceof Error ? err.message : "Could not generate PDF." });
    }
  }

  function statusBadge(status: BizDocRow["status"]) {
    const map: Record<string, string> = {
      paid: "border-transparent bg-success-soft text-success-foreground",
      accepted: "border-transparent bg-success-soft text-success-foreground",
      pending: "border-transparent bg-warning-soft text-warning-foreground",
      overdue: "border-transparent bg-destructive-soft text-destructive",
      declined: "border-transparent bg-destructive-soft text-destructive",
      draft: "border-transparent bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={map[status]}>{status}</Badge>;
  }

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
          <CardTitle className="text-[14.5px] font-semibold">
            {docTab === "invoice" ? "Invoices" : "Quotations"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex overflow-hidden rounded-lg border text-[12px]">
              {(["invoice", "quotation"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setDocTab(k)}
                  className={`px-3 py-1.5 font-medium capitalize transition-colors ${docTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {k === "invoice" ? `Invoices (${invoices.length})` : `Quotations (${quotes.length})`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                filename={`${docTab}-export`}
                rows={shown.length}
                label="Export"
                title={docTab === "invoice" ? "QuickRecon — Invoices" : "QuickRecon — Quotations"}
                data={{
                  columns: [docTab === "invoice" ? "Invoice #" : "Quote #", "Client", "Amount", "Currency", "Issued", docTab === "invoice" ? "Due" : "Valid Until", "Status"],
                  rows: shown.map((d) => [d.id, d.client, d.amount, d.currency, d.date, d.due ?? d.validUntil ?? "", d.status]),
                }}
              />
              <Button className="h-9 gap-1.5 text-[13px]" onClick={() => setCreateOpen(docTab)}>
                <FileText className="size-4" aria-hidden /> New {docTab === "invoice" ? "Invoice" : "Quotation"}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">{docTab === "invoice" ? "Invoice #" : "Quote #"}</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Issued</th>
                  <th className="px-3 py-2.5">{docTab === "invoice" ? "Due" : "Valid Until"}</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="w-10 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-hover">
                    <td className="font-mono text-[12px] px-3 py-2.5">{d.id}</td>
                    <td className="px-3 py-2.5 font-medium">{d.client}</td>
                    <td className="tnum px-3 py-2.5 text-right">{d.amount.toLocaleString()}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{d.date}</td>
                    <td className="tnum px-3 py-2.5 text-muted-foreground">{d.due ?? d.validUntil}</td>
                    <td className="px-3 py-2.5">{statusBadge(d.status)}</td>
                    <td className="px-3 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.id}`}>
                            <Ellipsis className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => downloadDoc(d)}>
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toast.success(`${d.id} marked as sent`, { description: `Delivered to ${d.client}` })}>
                            Mark Sent
                          </DropdownMenuItem>
                          {d.kind === "quotation" && d.status === "pending" && (
                            <DropdownMenuItem onSelect={() => setDocs((all) => all.map((x) => x.id === d.id ? { ...x, status: "accepted" as const } : x))}>
                              Mark Accepted
                            </DropdownMenuItem>
                          )}
                          {d.kind === "invoice" && d.status === "pending" && (
                            <DropdownMenuItem onSelect={() => setDocs((all) => all.map((x) => x.id === d.id ? { ...x, status: "paid" as const } : x))}>
                              Mark Paid
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {createOpen && (
        <BizDocDialog
          kind={createOpen}
          onClose={() => setCreateOpen(null)}
          onCreate={(d) => {
            setDocs((all) => [d, ...all]);
            setCreateOpen(null);
            toast.success(`${d.kind === "invoice" ? "Invoice" : "Quotation"} created`, { description: `${d.id} · ${d.client}` });
          }}
        />
      )}
    </div>
  );
}

/** Create invoice/quotation dialog with line items. */
function BizDocDialog({
  kind,
  onClose,
  onCreate,
}: {
  kind: "invoice" | "quotation";
  onClose: () => void;
  onCreate: (d: BizDocRow) => void;
}) {
  const [client, setClient] = React.useState("");
  const [clientContact, setClientContact] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [poNumber, setPoNumber] = React.useState("");
  const [currency, setCurrency] = React.useState<Currency>("ZWG");
  const [discountPct, setDiscountPct] = React.useState("");
  const [applyVat, setApplyVat] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DocLine[]>([{ description: "", qty: 1, unit: "svc", unitPrice: 0 }]);

  const lineNet = (l: DocLine) => l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);
  const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
  const discount = (parseFloat(discountPct) || 0) / 100 * subtotal;
  const vat = applyVat ? 0.155 * (subtotal - discount) : 0;
  const total = subtotal - discount + vat;
  const sym = currency === "ZWG" ? "ZiG" : "USD";
  const fmt = (v: number) => `${sym} ${v.toLocaleString("en-ZW", { minimumFractionDigits: 2 })}`;

  function updateLine(i: number, field: keyof DocLine, v: string | number) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [field]: v } : l)));
  }

  function create() {
    if (!client.trim()) { toast.error("Client name required"); return; }
    if (lines.some((l) => !l.description.trim())) { toast.error("All line items need a description"); return; }
    const prefix = kind === "invoice" ? "INV" : "QT";
    const id = `${prefix}-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
    onCreate({
      id,
      kind,
      client: client.trim(),
      clientContact: clientContact.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      poNumber: poNumber.trim() || undefined,
      amount: total,
      date: new Date().toISOString().slice(0, 10),
      due: kind === "invoice" ? new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10) : undefined,
      validUntil: kind === "quotation" ? new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10) : undefined,
      status: "draft",
      lines,
      currency,
      discountPct: parseFloat(discountPct) || undefined,
      vatRate: applyVat ? 0.155 : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>New {kind === "invoice" ? "Invoice" : "Quotation"}</DialogTitle>
          <DialogDescription>
            Full document — client details, line items with codes & discounts,
            VAT, terms and signature blocks are included in the PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client <span className="text-destructive">*</span></Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Contact Person</Label>
              <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="Attn: name" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client Email</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="accounts@client.co.zw" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Client Phone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+263 …" className="h-9 bg-card" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Client Address</Label>
            <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Street, suburb, city" className="h-9 bg-card" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">{kind === "invoice" ? "PO / Reference" : "Reference"}</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" className="h-9 bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZWG">ZiG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Discount %</Label>
              <Input type="number" min={0} max={100} step="0.5" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" className="h-9 bg-card" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px]">Line Items</Label>
            <div className="grid grid-cols-[70px_1fr_52px_56px_88px_56px_28px] gap-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase">
              <span>Code</span><span>Description</span><span>Qty</span><span>Unit</span><span>Price</span><span>Disc%</span><span></span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[70px_1fr_52px_56px_88px_56px_28px] items-center gap-1.5">
                <Input value={l.code ?? ""} onChange={(e) => updateLine(i, "code", e.target.value)} placeholder="SKU" className="h-8.5 bg-card text-[12px]" />
                <Input value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="Description" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={1} value={l.qty} onChange={(e) => updateLine(i, "qty", parseInt(e.target.value) || 1)} className="h-8.5 bg-card text-[12px]" />
                <Input value={l.unit ?? ""} onChange={(e) => updateLine(i, "unit", e.target.value)} placeholder="svc" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8.5 bg-card text-[12px]" />
                <Input type="number" min={0} max={100} value={l.discountPct ?? ""} onChange={(e) => updateLine(i, "discountPct", parseFloat(e.target.value) || 0)} placeholder="0" className="h-8.5 bg-card text-[12px]" />
                <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line">
                  ×
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[12px]" onClick={() => setLines((ls) => [...ls, { description: "", qty: 1, unit: "svc", unitPrice: 0 }])}>
              + Add line
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-[12.5px] font-medium">Apply VAT (15.5%)</p>
              <p className="text-[11px] text-muted-foreground">ZIMRA rate — added after discount.</p>
            </div>
            <Switch checked={applyVat} onCheckedChange={setApplyVat} aria-label="Apply VAT" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Settlement via RTGS — quote the invoice number." className="bg-card text-[12.5px]" />
          </div>

          <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-[12.5px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tnum">{fmt(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount ({discountPct}%)</span><span className="tnum">-{fmt(discount)}</span></div>}
            {applyVat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15.5%)</span><span className="tnum">{fmt(vat)}</span></div>}
            <div className="flex justify-between border-t pt-1.5 text-[14px] font-bold"><span>Total</span><span className="tnum">{fmt(total)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={create}>Create {kind === "invoice" ? "Invoice" : "Quotation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
