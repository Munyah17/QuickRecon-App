"use client";

import * as React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
          {trend && (
            <span className={`flex items-center gap-1 text-[11.5px] font-medium ${trendUp ? "text-success" : "text-destructive"}`}>
              {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {trend}
            </span>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">{label}</p>
        <p className="tnum text-[17px] font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
