"use client";

import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyDual, signedMoney } from "@/lib/format";
import type { Currency } from "@/types";

/**
 * Financial figure renderer — tabular numbers, optional sign colouring.
 * Closing positions tint red when negative, dark foreground otherwise.
 * Set `dual` to render both USD and ZiG (respects the display-mode setting).
 */
export function MoneyValue({
  amount,
  currency = "ZWG",
  signed = false,
  dual = false,
  className,
}: {
  amount: number;
  currency?: Currency;
  signed?: boolean;
  /** Show both currencies side by side ("ZiG 12,000 · USD 400"). */
  dual?: boolean;
  className?: string;
}) {
  if (dual) {
    return (
      <span
        className={cn(
          "tnum font-semibold",
          amount < 0 ? "text-destructive" : undefined,
          className
        )}
      >
        {formatMoneyDual(amount, currency)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "tnum font-semibold",
        amount < 0 ? "text-destructive" : undefined,
        className
      )}
    >
      {signed ? signedMoney(amount, currency) : formatMoney(amount, currency)}
    </span>
  );
}

/**
 * Stat-card money renderer. Shows the amount in the currency passed in.
 * Pass `dual` on MoneyValue only where a side-by-side comparison is intentional.
 */
export function StatMoney({
  amount,
  currency = "ZWG",
  className,
}: {
  amount: number;
  currency?: Currency;
  className?: string;
}) {
  return <MoneyValue amount={amount} currency={currency} className={className} />;
}
