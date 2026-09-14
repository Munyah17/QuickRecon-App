import { cn } from "@/lib/utils";
import { formatMoney, signedMoney } from "@/lib/format";
import type { Currency } from "@/types";

/**
 * Financial figure renderer — tabular numbers, optional sign colouring.
 * Closing positions tint red when negative, dark foreground otherwise.
 */
export function MoneyValue({
  amount,
  currency = "ZWG",
  signed = false,
  className,
}: {
  amount: number;
  currency?: Currency;
  signed?: boolean;
  className?: string;
}) {
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
