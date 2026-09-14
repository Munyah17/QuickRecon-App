"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/workspace-provider";
import { formatPeriod } from "@/lib/format";
import { useMemo } from "react";

/** Last N months rendered for the period picker, newest first. */
function recentMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Reporting-period selector that propagates across scoped views. */
export function PeriodSelector({
  months = 8,
  align = "start",
}: {
  months?: number;
  align?: "start" | "end";
}) {
  const { period, setPeriod } = useWorkspace();
  const options = useMemo(() => recentMonths(months), [months]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 border-border bg-card px-3 text-[13px] font-medium"
          aria-label="Select reporting period"
        >
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <span className="hidden sm:inline">{formatPeriod(period)}</span>
          <span className="sm:hidden">{formatPeriod(period).slice(0, 3)} {period.slice(2, 4)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        <DropdownMenuLabel className="text-[11px] tracking-wide text-muted-foreground">
          Reporting period
        </DropdownMenuLabel>
        {options.map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => setPeriod(p)}
            className="text-[13px]"
          >
            <span className="flex-1">{formatPeriod(p)}</span>
            {period === p && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
