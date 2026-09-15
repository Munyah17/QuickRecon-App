"use client";

import * as React from "react";
import { CURRENCY_SETTINGS_KEY } from "@/lib/format";
import type { Currency } from "@/types";

export const CURRENCY_EVENT = "qr:currency";

/** Read the current display currency (client). */
export function getDisplayCurrency(): Currency {
  if (typeof window === "undefined") return "ZWG";
  try {
    const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
    const v = raw ? JSON.parse(raw)?.defaultCurrency : null;
    if (v === "USD" || v === "ZWG") return v;
  } catch {
    /* ignore */
  }
  return "ZWG";
}

function setDisplayCurrency(cur: Currency) {
  try {
    const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.defaultCurrency = cur;
    window.localStorage.setItem(CURRENCY_SETTINGS_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: cur }));
}

/**
 * Floating USD/ZiG switcher — fixed bottom-right, above the mobile
 * bottom nav. Remounts the page content so every formatted money value
 * re-renders in the selected currency. Purely presentational — does not
 * convert amounts (conversion is the reconciliation engine's job).
 */
export function CurrencySwitcher() {
  const currency = React.useSyncExternalStore(
    (cb) => { window.addEventListener(CURRENCY_EVENT, cb); return () => window.removeEventListener(CURRENCY_EVENT, cb); },
    getDisplayCurrency,
    () => "ZWG" as Currency
  );
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only flag to avoid SSR/hydration mismatch on localStorage value
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 flex items-center overflow-hidden rounded-full border bg-card shadow-lg lg:bottom-6 lg:right-6"
      role="group"
      aria-label="Display currency"
    >
      {(["USD", "ZWG"] as const).map((c) => (
        <button
          key={c}
          onClick={() => setDisplayCurrency(c)}
          aria-pressed={currency === c}
          className={
            currency === c
              ? "px-3.5 py-2 text-[12px] font-bold bg-primary text-primary-foreground"
              : "px-3.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          {c === "ZWG" ? "ZiG" : "USD"}
        </button>
      ))}
    </div>
  );
}

/**
 * Remounts children when the display currency changes so every
 * formatMoney() call re-renders with the new currency.
 */
export function CurrencyRemount({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CURRENCY_EVENT, on);
    return () => window.removeEventListener(CURRENCY_EVENT, on);
  }, []);
  return <React.Fragment key={tick}>{children}</React.Fragment>;
}
