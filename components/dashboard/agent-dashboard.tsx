"use client";

import Link from "next/link";
import {
  CreditCard,
  Receipt,
  Banknote,
  Wallet,
  MapPin,
  Download,
  Plus,
  ArrowUpRight,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { ModuleSelector } from "@/components/shared/module-selector";
import { PeriodSelector } from "@/components/shared/period-selector";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyValue } from "@/components/shared/money-value";
import dynamic from "next/dynamic";
import { ChartCard, ChartLegendItem } from "@/components/shared/chart-card";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem, Agent, Booth } from "@/types";
import { mockAgentPerformance, mockBoothRevenue } from "@/lib/data/mock";
import { formatMoneyCompact, formatPeriod } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";

const TrendChart = dynamic(() => import("@/components/charts/trend-chart").then(m => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full rounded-lg" />,
});
const BarsChart = dynamic(() => import("@/components/charts/trend-chart").then(m => m.BarsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});
const DonutChart = dynamic(() => import("@/components/charts/donut-chart").then(m => m.DonutChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-lg" />,
});

const BOOTH_COLORS = [
  "var(--color-brand-600)",
  "var(--color-brand-400)",
  "var(--color-brand-700)",
  "var(--color-brand-200)",
];

export function AgentDashboard({
  agent,
  booths,
  activities,
  greeting,
}: {
  agent: Agent;
  booths: Booth[];
  activities: ActivityItem[];
  greeting: string;
}) {
  const { period } = useWorkspace();
  const m = agent.metrics;

  const boothSeries = booths.slice(0, 3).map((b, i) => ({
    month: b.name.split(" ")[0],
    value: mockBoothRevenue()[i % mockBoothRevenue().length].value,
    fill: BOOTH_COLORS[i],
  }));

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Greeting + scope controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-bold tracking-tight sm:text-[26px]">
            <span className="lg:hidden">{greeting}, {agent.fullName} 👋</span>
            <span className="hidden lg:inline">Welcome, {agent.fullName}</span>
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="lg:hidden">Here&apos;s your reconciliation summary</span>
            <span className="hidden lg:inline">
              Here&apos;s your reconciliation overview for {formatPeriod(period)}.
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
            <ModuleSelector allowAll={false} />
            <PeriodSelector />
          </div>
        </div>
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <Button variant="outline" className="h-9 gap-1.5 text-[13px]">
            <Download className="size-4" aria-hidden /> Download Report
          </Button>
          <Button className="h-9 gap-1.5 text-[13px]" asChild>
            <Link href="/app/submissions?new=1">
              <Plus className="size-4" aria-hidden /> New Submission
            </Link>
          </Button>
        </div>
      </div>

      {/* Financial metrics — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Total Insurance"
          value={<MoneyValue amount={m?.totalInsurance ?? 0} currency={m?.currency} />}
          icon={CreditCard}
          iconTone="primary"
          deltaPct={m?.insuranceChangePct ?? 0}
        />
        <MetricCard
          label="Total ZINARA"
          value={<MoneyValue amount={m?.totalZinara ?? 0} currency={m?.currency} />}
          icon={Receipt}
          iconTone="success"
          deltaPct={m?.zinaraChangePct ?? 0}
        />
        <MetricCard
          label="Total Deposits"
          value={<MoneyValue amount={m?.totalDeposits ?? 0} currency={m?.currency} />}
          icon={Banknote}
          iconTone="violet"
          deltaPct={m?.depositsChangePct ?? 0}
        />
        <MetricCard
          label="Closing Position"
          value={<MoneyValue className="text-destructive" amount={m?.closingPosition ?? 0} currency={m?.currency} />}
          icon={Wallet}
          iconTone="danger"
          deltaPct={m?.closingChangePct ?? 0}
          negativeGood
        />
      </div>

      {/* Performance chart + collections donut */}
      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title="Monthly Performance (ZiG)"
          className="lg:col-span-7"
          legend={
            <>
              <ChartLegendItem color="var(--color-brand-600)" label="Insurance" />
              <ChartLegendItem color="var(--color-brand-300)" label="ZINARA" />
            </>
          }
          actions={
            <Link
              href="/app/reports"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              View Report <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          }
        >
          <TrendChart
            data={mockAgentPerformance()}
            series={[
              { key: "insurance", label: "Insurance", color: "var(--color-brand-600)" },
              { key: "zinara", label: "ZINARA", color: "var(--color-brand-300)" },
            ]}
            height={250}
          />
        </ChartCard>

        <ChartCard title="Collections by Booth" className="lg:col-span-5">
          <DonutChart
            data={mockBoothRevenue().map((b, i) => ({
              name: b.name,
              value: b.value,
              color: BOOTH_COLORS[i % BOOTH_COLORS.length],
            }))}
            height={170}
            center={
              <>
                <span className="tnum text-[20px] font-bold tracking-tight">
                  {formatMoneyCompact(m?.totalInsurance ?? 0)}
                </span>
                <span className="text-[11px] text-muted-foreground">This month</span>
              </>
            }
          />
          <ul className="mt-2 space-y-1.5 px-3 pb-1">
            {mockBoothRevenue().map((b, i) => (
              <li key={b.name} className="flex items-center gap-2 text-[12px]">
                <span
                  className="size-2 rounded-full"
                  style={{ background: BOOTH_COLORS[i % BOOTH_COLORS.length] }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-muted-foreground">{b.name}</span>
                <span className="tnum font-semibold">{b.pct}%</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* Booths, volume, activity */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="gap-0 py-0 shadow-xs lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-2 sm:px-5">
            <CardTitle className="text-[14.5px] font-semibold">My Booths</CardTitle>
            <Store className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5">
            {booths.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <MapPin className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{b.name}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {b.location} · {b.assistantsCount} assistant{b.assistantsCount === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/app/booths">View all booths</Link>
            </Button>
          </CardContent>
        </Card>

        <ChartCard title="Transactions per Booth" subtitle="Collections this month" className="lg:col-span-5">
          <BarsChart
            data={boothSeries.length ? boothSeries : [{ month: "No booths", value: 0, fill: BOOTH_COLORS[0] }]}
            series={[{ key: "value", label: "Collected", color: "var(--color-brand-600)" }]}
            height={210}
          />
        </ChartCard>

        <ChartCard title="Recent Activity" className="lg:col-span-3">
          <div className="px-4">
            <ActivityFeed items={activities.slice(0, 4)} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
