"use client";

import Link from "next/link";
import { Users, UserRoundCheck, ShieldCheck, TriangleAlert, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { ModuleSelector } from "@/components/shared/module-selector";
import { PeriodSelector } from "@/components/shared/period-selector";
import { PageHeader } from "@/components/layout/page-header";
import dynamic from "next/dynamic";
import { ChartCard, ChartLegendItem } from "@/components/shared/chart-card";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "@/types";
import { mockRevenueTrend } from "@/lib/data/mock";

const TrendChart = dynamic(() => import("@/components/charts/trend-chart").then(m => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[232px] w-full rounded-lg" />,
});
const DonutChart = dynamic(() => import("@/components/charts/donut-chart").then(m => m.DonutChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[170px] w-full rounded-lg" />,
});

const MODULE_DONUT = [
  { name: "Enpassent", value: 160, color: "var(--color-brand-600)" },
  { name: "Econet Moovah", value: 72, color: "var(--color-brand-400)" },
  { name: "Both", value: 16, color: "var(--color-brand-200)" },
];

export function AdminDashboard({
  firstName,
  activities,
}: {
  firstName: string;
  activities: ActivityItem[];
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Mobile greeting (per mobile mockup #2) */}
      <div className="space-y-4 lg:hidden">
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="p-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Module
            </p>
            <ModuleSelector allowAll />
          </CardContent>
        </Card>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Good day, {firstName}</h1>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{today}</p>
          </div>
        </div>
      </div>

      {/* Desktop header (per PC mockup #2) */}
      <div className="hidden lg:block">
        <PageHeader
          title="Dashboard"
          description="Overview of your agent network and reconciliation activities"
          actions={
            <>
              <ModuleSelector allowAll />
              <PeriodSelector align="end" />
            </>
          }
        />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Total Agents"
          value="248"
          icon={Users}
          iconTone="primary"
          deltaPct={12}
          deltaLabel="this month"
        />
        <MetricCard
          label="Active Agents"
          value="236"
          icon={UserRoundCheck}
          iconTone="success"
          footer={<span className="text-muted-foreground">95% of total</span>}
        />
        <MetricCard
          label="Reconciled Agents"
          value="222"
          icon={ShieldCheck}
          iconTone="primary"
          footer={<span className="text-muted-foreground">90% completion</span>}
        />
        <MetricCard
          label="Pending Issues"
          value="14"
          icon={TriangleAlert}
          iconTone="warning"
          footer={<span className="font-medium text-warning-foreground">Require attention</span>}
        />
      </div>

      {/* Charts + activity */}
      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title="Revenue Trend (ZiG)"
          subtitle="January — August"
          className="lg:col-span-5"
          legend={
            <>
              <ChartLegendItem color="var(--color-brand-600)" label="Insurance Revenue" />
              <ChartLegendItem color="var(--color-brand-300)" label="ZINARA Revenue" />
            </>
          }
        >
          <TrendChart
            data={mockRevenueTrend()}
            series={[
              { key: "insurance", label: "Insurance Revenue", color: "var(--color-brand-600)" },
              { key: "zinara", label: "ZINARA Revenue", color: "var(--color-brand-300)" },
            ]}
            height={232}
          />
        </ChartCard>

        <ChartCard title="Agents by Module" className="lg:col-span-3">
          <DonutChart
            data={MODULE_DONUT}
            height={170}
            center={
              <>
                <span className="text-[24px] font-bold tracking-tight">248</span>
                <span className="text-[11px] text-muted-foreground">Agents</span>
              </>
            }
          />
          <ul className="mt-2 space-y-1.5 px-3 pb-1">
            {MODULE_DONUT.map((d) => {
              const pct = Math.round((d.value / 248) * 100);
              return (
                <li key={d.name} className="flex items-center gap-2 text-[12px]">
                  <span className="size-2 rounded-full" style={{ background: d.color }} aria-hidden />
                  <span className="flex-1 text-muted-foreground">{d.name}</span>
                  <span className="tnum font-semibold">{d.value}</span>
                  <span className="tnum w-9 text-right text-muted-foreground">({pct}%)</span>
                </li>
              );
            })}
          </ul>
        </ChartCard>

        <ChartCard
          title="Recent Activities"
          className="lg:col-span-4"
          actions={
            <Link
              href="/app/notifications"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              View all <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          }
        >
          <div className="px-4">
            <ActivityFeed items={activities.slice(0, 5)} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
