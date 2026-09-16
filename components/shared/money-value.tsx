"use client";

import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyDual, getDisplayMode, signedMoney } from "@/lib/format";
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
 * Auto-dual money renderer — reads the display-mode setting. When the mode
 * is "both" the value renders in both currencies; otherwise single.
 * Use on stat cards and headline money figures.
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
  const mode = getDisplayMode();
  return (
    <MoneyValue
      amount={amount}
      currency={currency}
      dual={mode === "both"}
      className={className}
    />
  );
}
