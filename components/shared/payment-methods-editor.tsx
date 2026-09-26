"use client";

import * as React from "react";
import { toast } from "sonner";
import { Landmark, Smartphone, Wallet, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export type PaymentMethod = {
  id: number;
  owner_type: "staff" | "agent";
  owner_id: string;
  kind: "bank" | "mobile_money" | "other";
  label: string | null;
  bank_name: string | null;
  branch_code: string | null;
  account_name: string | null;
  account_number: string | null;
  provider: string | null;
  mobile_number: string | null;
  currency: string;
  is_primary: boolean;
  details: Record<string, unknown>;
};

const KIND_META = {
  bank: { label: "Bank account", icon: Landmark },
  mobile_money: { label: "Mobile money", icon: Smartphone },
  other: { label: "Other", icon: Wallet },
} as const;

const PROVIDERS = [
  { value: "ecocash", label: "EcoCash" },
  { value: "onemoney", label: "OneMoney" },
  { value: "innbucks", label: "InnBucks" },
  { value: "other", label: "Other" },
];

const CURRENCIES = ["USD", "ZWG"];

function summarize(m: PaymentMethod): string {
  if (m.kind === "bank") {
    return [m.bank_name, m.account_name, m.account_number ? `Acc ${m.account_number}` : null, m.branch_code]
      .filter(Boolean).join(" · ");
  }
  if (m.kind === "mobile_money") {
    const p = PROVIDERS.find((x) => x.value === m.provider)?.label ?? m.provider;
    return [p, m.mobile_number].filter(Boolean).join(" · ");
  }
  return (m.details?.notes as string) || m.label || "—";
}

type Draft = {
  kind: "bank" | "mobile_money" | "other";
  label: string;
  bankName: string;
  branchCode: string;
  accountName: string;
  accountNumber: string;
  provider: string;
  mobileNumber: string;
  currency: string;
  isPrimary: boolean;
  notes: string;
};

const EMPTY: Draft = {
  kind: "bank", label: "", bankName: "", branchCode: "", accountName: "",
  accountNumber: "", provider: "ecocash", mobileNumber: "", currency: "USD",
  isPrimary: false, notes: "",
};

function toDraft(m: PaymentMethod): Draft {
  return {
    kind: m.kind,
    label: m.label ?? "",
    bankName: m.bank_name ?? "",
    branchCode: m.branch_code ?? "",
    accountName: m.account_name ?? "",
    accountNumber: m.account_number ?? "",
    provider: m.provider ?? "ecocash",
    mobileNumber: m.mobile_number ?? "",
    currency: m.currency ?? "USD",
    isPrimary: m.is_primary,
    notes: (m.details?.notes as string) ?? "",
  };
}

/**
 * Remuneration payment methods editor — manage 3+ optional bank accounts,
 * mobile-money wallets and other payout details for a staff or agent profile.
 * All changes persist to the payment_methods table via /api/payment-methods.
 */
export function PaymentMethodsEditor({
  ownerType,
  ownerId,
}: {
  ownerType: "staff" | "agent";
  ownerId: string;
}) {
  const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PaymentMethod | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/payment-methods?ownerType=${ownerType}&ownerId=${encodeURIComponent(ownerId)}`
      );
      const data = (await res.json().catch(() => ({}))) as { methods?: PaymentMethod[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setMethods(data.methods ?? []);
    } catch (e) {
      toast.error("Could not load payment methods", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  React.useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  function openAdd() {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  }
  function openEdit(m: PaymentMethod) {
    setEditing(m);
    setDraft(toDraft(m));
    setOpen(true);
  }

  function validate(): string | null {
    if (draft.kind === "bank" && !draft.bankName.trim() && !draft.accountNumber.trim()) {
      return "Enter the bank name and/or account number.";
    }
    if (draft.kind === "mobile_money" && !draft.mobileNumber.trim()) {
      return "Enter the mobile money number.";
    }
    if (draft.kind === "other" && !draft.label.trim() && !draft.notes.trim()) {
      return "Describe this payment method.";
    }
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload = {
        ownerType, ownerId,
        kind: draft.kind,
        label: draft.label || null,
        bankName: draft.bankName || null,
        branchCode: draft.branchCode || null,
        accountName: draft.accountName || null,
        accountNumber: draft.accountNumber || null,
        provider: draft.kind === "mobile_money" ? draft.provider : null,
        mobileNumber: draft.mobileNumber || null,
        currency: draft.currency,
        isPrimary: draft.isPrimary,
        details: draft.notes ? { notes: draft.notes } : {},
      };
      const res = await fetch(
        editing ? `/api/payment-methods/${editing.id}` : "/api/payment-methods",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Payment method updated" : "Payment method added");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error("Save failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      toast.success("Payment method removed");
      setMethods((p) => p.filter((m) => m.id !== id));
    } catch (e) {
      toast.error("Delete failed", { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function setPrimary(m: PaymentMethod) {
    try {
      const res = await fetch(`/api/payment-methods/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) throw new Error("Update failed");
      await load();
    } catch (e) {
      toast.error("Could not set primary", { description: e instanceof Error ? e.message : undefined });
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-muted-foreground">
          Remuneration payment methods
        </p>
        <Button type="button" size="sm" variant="outline" className="h-7.5 gap-1 text-[12px]" onClick={openAdd}>
          <Plus className="size-3.5" aria-hidden /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-[12px] text-muted-foreground">Loading…</p>
      ) : methods.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-[12px] text-muted-foreground">
          No payment methods yet — add a bank account, mobile money wallet or other payout detail.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {methods.map((m) => {
            const Icon = KIND_META[m.kind].icon;
            return (
              <li key={m.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">
                      {m.label || KIND_META[m.kind].label}
                    </span>
                    {m.is_primary && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="size-2.5 fill-current" aria-hidden /> Primary
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11.5px] text-muted-foreground">{summarize(m)}</p>
                </div>
                {!m.is_primary && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setPrimary(m)} title="Set as primary">
                    <Star className="size-3.5" aria-hidden />
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(m)} title="Edit">
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" title="Remove">
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  }
                  title="Remove payment method?"
                  description="This payout detail will be permanently deleted."
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => remove(m.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">{editing ? "Edit" : "Add"} payment method</DialogTitle>
            <DialogDescription className="text-[13px]">
              Bank account, mobile money wallet or other payout detail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Type</Label>
                <Select value={draft.kind} onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as Draft["kind"] }))}>
                  <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank account</SelectItem>
                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Label (optional)</Label>
                <Input value={draft.label} onChange={set("label")} placeholder="e.g. Primary" className="h-9 bg-card" />
              </div>
            </div>

            {draft.kind === "bank" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Bank</Label>
                    <Input value={draft.bankName} onChange={set("bankName")} placeholder="e.g. CBZ" className="h-9 bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Branch code</Label>
                    <Input value={draft.branchCode} onChange={set("branchCode")} className="h-9 bg-card" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Account name</Label>
                    <Input value={draft.accountName} onChange={set("accountName")} className="h-9 bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Account number</Label>
                    <Input value={draft.accountNumber} onChange={set("accountNumber")} className="h-9 bg-card" />
                  </div>
                </div>
              </>
            )}

            {draft.kind === "mobile_money" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Provider</Label>
                  <Select value={draft.provider} onValueChange={(v) => setDraft((d) => ({ ...d, provider: v }))}>
                    <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Mobile number</Label>
                  <Input value={draft.mobileNumber} onChange={set("mobileNumber")} placeholder="+263 77 …" className="h-9 bg-card" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Currency</Label>
                <Select value={draft.currency} onValueChange={(v) => setDraft((d) => ({ ...d, currency: v }))}>
                  <SelectTrigger className="h-9 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-[12.5px]">
                  <Checkbox
                    checked={draft.isPrimary}
                    onCheckedChange={(c) => setDraft((d) => ({ ...d, isPrimary: c === true }))}
                  />
                  Primary payout method
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px]">Notes (optional)</Label>
              <Input value={draft.notes} onChange={set("notes")} placeholder="SWIFT, reference, instructions…" className="h-9 bg-card" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
