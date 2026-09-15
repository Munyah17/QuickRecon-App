"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Simple light↔dark switch (no dropdown): sun on the left, moon on the
 * right, thumb slides to the active side.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors",
        dark ? "bg-brand-700 border-brand-600" : "bg-muted border-border"
      )}
    >
      <Sun
        className={cn(
          "absolute left-1.5 size-3.5 transition-colors",
          dark ? "text-white/40" : "text-warning-foreground"
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute right-1.5 size-3.5 transition-colors",
          dark ? "text-white" : "text-muted-foreground"
        )}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-0.5 size-5.5 rounded-full bg-card shadow transition-transform",
          dark ? "translate-x-[30px]" : "translate-x-0.5"
        )}
        aria-hidden
      />
    </button>
  );
}
