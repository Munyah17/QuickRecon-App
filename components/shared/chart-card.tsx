import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  legend,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0 shadow-xs", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2 px-4 pt-4 pb-0 sm:px-5">
        <div>
          <CardTitle className="text-[14.5px] font-semibold">{title}</CardTitle>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          {actions}
        </div>
      </CardHeader>
      <CardContent className={cn("px-2 pt-3 pb-4 sm:px-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

/** Small dot+label used for chart legends. */
export function ChartLegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span
        className="size-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
