import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Dashboard metric card in the QuickRecon language:
 * small muted label, large tabular value, optional delta + icon chip.
 */
export function MetricCard({
  label,
  value,
  deltaPct,
  deltaLabel,
  icon: Icon,
  iconTone = "primary",
  footer,
  className,
  negativeGood = false,
}: {
  label: string;
  value: ReactNode;
  deltaPct?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  iconTone?: "primary" | "success" | "warning" | "danger" | "neutral" | "violet";
  footer?: ReactNode;
  className?: string;
  negativeGood?: boolean;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-destructive-soft text-destructive",
    neutral: "bg-muted text-muted-foreground",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  };

  const showDelta = typeof deltaPct === "number";
  const improved = negativeGood ? (deltaPct ?? 0) < 0 : (deltaPct ?? 0) >= 0;

  return (
    <Card className={cn("gap-0 py-0 shadow-xs", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12.5px] font-medium text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                tones[iconTone]
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="tnum mt-1 text-[22px] font-bold tracking-tight sm:text-[24px]">
          {value}
        </div>
        {showDelta || footer ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            {showDelta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  improved ? "text-success-foreground" : "text-destructive"
                )}
              >
                {improved ? (
                  <TrendingUp className="size-3" aria-hidden />
                ) : (
                  <TrendingDown className="size-3" aria-hidden />
                )}
                {Math.abs(deltaPct ?? 0)}%
              </span>
            ) : null}
            {deltaLabel ? (
              <span className="text-muted-foreground">{deltaLabel}</span>
            ) : (
              showDelta && (
                <span className="text-muted-foreground">from last month</span>
              )
            )}
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
