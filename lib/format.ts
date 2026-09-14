import type { Currency } from "@/types";
import { format, parseISO } from "date-fns";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  ZWG: "ZiG",
  USD: "USD",
};

/** "ZiG 1,248,320" / "USD 1,250.00" — never silently mix currencies. */
export function formatMoney(amount: number, currency: Currency = "ZWG"): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const formatted = new Intl.NumberFormat("en-ZW", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZW").format(value);
}

/** Compact form for chart axes: 1.2M / 450K */
export function formatMoneyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return `${amount}`;
}

export function signedMoney(amount: number, currency: Currency = "ZWG"): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatMoney(Math.abs(amount), currency)}`;
}

export function formatDate(iso: string, pattern = "dd MMM yyyy"): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function formatPeriod(period: string): string {
  // "2026-08" -> "August 2026"
  try {
    const [y, m] = period.split("-").map(Number);
    return format(new Date(y, m - 1, 1), "MMMM yyyy");
  } catch {
    return period;
  }
}

export function moduleName(code: string): string {
  if (code === "enpassent") return "Enpassent";
  if (code === "econet-moovah") return "Econet Moovah";
  return "All Modules";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
