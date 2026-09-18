"use client";

import * as React from "react";
import {
  Calculator,
  Banknote,
  DollarSign,
  Receipt,
  Plus,
  FileDown,
  LoaderCircle,
  CloudUpload,
  Ellipsis,
} from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function AccountingTab() {
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
