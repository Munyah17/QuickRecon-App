"use client";

import { CURRENCY_SETTINGS_KEY } from "@/lib/format";

/**
 * Query-string fragment for export/download URLs — `&currency=USD` when the
 * currency settings picked a single currency, empty for both. The on-screen
 * USD/ZiG switcher was removed; Settings still controls this preference.
 */
export function displayCurrencyParam(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(CURRENCY_SETTINGS_KEY);
    const v = raw ? JSON.parse(raw)?.defaultCurrency : null;
    return v === "USD" || v === "ZWG" ? `&currency=${v}` : "";
  } catch {
    return "";
  }
}

