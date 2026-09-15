"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/format";
import type { Txn } from "@/types";

const FILTERS = ["all", "insurance", "zinara", "deposits"] as const;

const CAT_ICON: Record<Txn["category"], string> = {
  insurance: "IN",
  zinara: "ZN",
  deposit: "DP",
};
const CAT_STYLE: Record<Txn["category"], string> = {
  insurance: "bg-primary-soft text-primary",
  zinara: "bg-warning-soft text-warning-foreground",
  deposit: "bg-success-soft text-success-foreground",
};
const CAT_BADGE: Record<Txn["category"], string> = {
  insurance: "insurance",
  zinara: "zinara",
  deposit: "deposit",
};

export function TransactionsList({ transactions }: { transactions: Txn[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all");

  const rows = transactions.filter((t) => {
    const matchesFilter =
      filter === "all" || (filter === "deposits" ? t.category === "deposit" : t.category === filter);
    const q = query.toLowerCase();
    const matchesQuery =
      !q || t.title.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions…"
            className="h-10 bg-card pl-9"
            aria-label="Search transactions"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground"
                : "h-8 shrink-0 rounded-full border bg-card px-3.5 text-[12px] font-medium text-muted-foreground"
            }
          >
            {f === "all" ? "All" : f === "zinara" ? "ZINARA" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map((t) => (
          <Card key={t.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="flex items-center gap-3 p-3.5">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${CAT_STYLE[t.category]}`}>
                {CAT_ICON[t.category]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{t.title}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {t.subtitle} · {formatDate(t.date, "dd MMM yyyy")}
                </p>
              </div>
              <div className="text-right">
                <p className="tnum text-[13.5px] font-bold">{formatMoney(t.amount, t.currency)}</p>
                <div className="mt-0.5">
                  <StatusBadge status={CAT_BADGE[t.category]} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed py-10 text-center text-[13px] text-muted-foreground">
            No transactions match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
