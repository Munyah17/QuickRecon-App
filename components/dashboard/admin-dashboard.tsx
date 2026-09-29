"use client";

import Link from "next/link";
import { Users, UserRoundCheck, ShieldCheck, TriangleAlert, ArrowUpRight, Upload, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface AdminSummary {
  totalAgents: number;
  activeAgents: number;
  reconciledAgents: number;
  pendingIssues: number;
  activePct: number;
  reconciledPct: number;
  newThisMonth: number;
  moduleDonut: { name: string; value: number; color: string }[];
  revenueTrend: { month: string; insurance: number; zinara: number }[];
}

const TrendChart = dynamic(() => import("@/components/charts/trend-chart").then(m => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[232px] w-full rounded-lg" />,
});
const DonutChart = dynamic(() => import("@/components/charts/donut-chart").then(m => m.DonutChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[170px] w-full rounded-lg" />,
});

export function AdminDashboard({
  firstName,
  activities,
  summary,
}: {
  firstName: string;
  activities: ActivityItem[];
  summary: AdminSummary;
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
      <div className="space-y-3 lg:hidden">
        <Card className="gap-0 py-0 shadow-xs">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Module
              </p>
              <ModuleSelector allowAll />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Period
              </p>
              <PeriodSelector />
            </div>
          </CardContent>
        </Card>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Good day, {firstName}</h1>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{today}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-9 gap-1.5 text-[12.5px]" asChild>
            <Link href="/app/imports">
              <Upload className="size-4" aria-hidden /> New Import
            </Link>
          </Button>
          <Button className="h-9 gap-1.5 text-[12.5px]" asChild>
            <Link href="/app/reconciliation">
              <RefreshCcw className="size-4" aria-hidden /> Recon Workbench
            </Link>
          </Button>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MetricCard
          label="Total Agents"
          value={summary.totalAgents}
          icon={Users}
          iconTone="primary"
          footer={
            <span className="text-muted-foreground">
              {summary.newThisMonth} joined this month
            </span>
          }
        />
        <MetricCard
          label="Active Agents"
          value={summary.activeAgents}
          icon={UserRoundCheck}
          iconTone="success"
          footer={<span className="text-muted-foreground">{summary.activePct}% of total</span>}
        />
        <MetricCard
          label="Reconciled Agents"
          value={summary.reconciledAgents}
          icon={ShieldCheck}
          iconTone="primary"
          footer={<span className="text-muted-foreground">{summary.reconciledPct}% completion</span>}
        />
        <MetricCard
          label="Pending Issues"
          value={summary.pendingIssues}
          icon={TriangleAlert}
          iconTone="warning"
          footer={<span className="font-medium text-warning-foreground">Require attention</span>}
        />
      </div>

      {/* Charts + activity */}
      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title="Revenue Trend"
          subtitle={
            summary.revenueTrend.length > 1
              ? `${summary.revenueTrend[0].month} — ${summary.revenueTrend[summary.revenueTrend.length - 1].month}`
              : undefined
          }
          className="lg:col-span-5"
          legend={
            <>
              <ChartLegendItem color="var(--color-brand-600)" label="Insurance Revenue" />
              <ChartLegendItem color="var(--color-brand-300)" label="ZINARA Revenue" />
            </>
          }
        >
          {summary.revenueTrend.length ? (
            <TrendChart
              data={summary.revenueTrend}
              series={[
                { key: "insurance", label: "Insurance Revenue", color: "var(--color-brand-600)" },
                { key: "zinara", label: "ZINARA Revenue", color: "var(--color-brand-300)" },
              ]}
              height={232}
            />
          ) : (
            <p className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">
              No reconciliation data yet — import a workbook to populate this chart.
            </p>
          )}
        </ChartCard>

        <ChartCard title="Agents by Module" className="lg:col-span-3">
          {summary.moduleDonut.length ? (
            <>
              <DonutChart
                data={summary.moduleDonut}
                height={170}
                center={
                  <>
                    <span className="text-[24px] font-bold tracking-tight">{summary.totalAgents}</span>
                    <span className="text-[11px] text-muted-foreground">Agents</span>
                  </>
                }
              />
              <ul className="mt-2 space-y-1.5 px-3 pb-1">
                {summary.moduleDonut.map((d) => {
                  const pct = summary.totalAgents
                    ? Math.round((d.value / summary.totalAgents) * 100)
                    : 0;
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
            </>
          ) : (
            <p className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">
              No module access configured on agents yet.
            </p>
          )}
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
