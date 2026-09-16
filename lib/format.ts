import type { Currency } from "@/types";
import { format, parseISO } from "date-fns";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  ZWG: "ZiG",
  USD: "USD",
};

export const CURRENCY_SETTINGS_KEY = "qr_currency_config";

export type CurrencyDisplayMode = "USD" | "ZWG" | "both";

/** Persisted default display currency (set in Settings → Currency). */
export function getDefaultCurrency(): Currency {
  const mode = getDisplayMode();
  return mode === "both" ? "ZWG" : mode;
}

/** USD | ZWG | both — controls whether money stat cards show one or both. */
export function getDisplayMode(): CurrencyDisplayMode {
  if (typeof window === "undefined") return "ZWG";
  try {
    const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
    const v = raw ? JSON.parse(raw)?.defaultCurrency : null;
    if (v === "USD" || v === "ZWG" || v === "both") return v;
  } catch {
    /* ignore */
  }
  return "ZWG";
}

/** USD↔ZiG conversion rate used for the "both" display (1 USD = rate ZiG). */
export function getUsdZwgRate(): number {
  if (typeof window === "undefined") return 26.5;
  try {
    const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
    const cfg = raw ? JSON.parse(raw) : null;
    const r = cfg?.manualRate ?? cfg?.usdZwgRate;
    if (typeof r === "number" && r > 0) return r;
  } catch {
    /* ignore */
  }
  return 26.5;
}

/** Dual-currency display: "ZiG 12,000 · USD 400.00" using the configured rate. */
export function formatMoneyDual(amount: number, base?: Currency): string {
  const cur = base ?? getDefaultCurrency();
  const rate = getUsdZwgRate();
  const other = cur === "ZWG" ? amount / rate : amount * rate;
  const otherCur: Currency = cur === "ZWG" ? "USD" : "ZWG";
  return `${formatMoneySingle(amount, cur)} · ${formatMoneySingle(other, otherCur)}`;
}

function formatMoneySingle(amount: number, cur: Currency): string {
  const symbol = CURRENCY_SYMBOL[cur];
  const formatted = new Intl.NumberFormat("en-ZW", {
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

/** "ZiG 1,248,320" / "USD 1,250.00" — never silently mix currencies.
 * When the display mode is "both", renders dual ("ZiG 12,000 · USD 400"). */
export function formatMoney(amount: number, currency?: Currency): string {
  const cur = currency ?? getDefaultCurrency();
  if (getDisplayMode() === "both") return formatMoneyDual(amount, cur);
  return formatMoneySingle(amount, cur);
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

export function signedMoney(amount: number, currency?: Currency): string {
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
