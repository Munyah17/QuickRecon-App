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
import type { ActivityItem, Agent, AgentPeriodMetrics, Booth } from "@/types";
import { formatPeriod } from "@/lib/format";
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
  periodMetrics,
}: {
  agent: Agent;
  booths: Booth[];
  activities: ActivityItem[];
  greeting: string;
  periodMetrics: AgentPeriodMetrics[];
}) {
  const { period } = useWorkspace();

  // Metrics for the selected reporting period, falling back to the most
  // recent period that has data, then to the static metrics on the agent row.
  const idx = periodMetrics.findIndex((p) => p.period === period);
  const m = idx >= 0 ? periodMetrics[idx] : periodMetrics[0] ?? agent.metrics;
  const prev = idx >= 0 ? periodMetrics[idx + 1] : periodMetrics[1];
  const pct = (cur?: number, base?: number) =>
    cur != null && base ? Math.round(((cur - base) / Math.abs(base)) * 100) : undefined;

  const perfSeries = [...periodMetrics]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-8)
    .map((p) => ({
      month: new Date(`${p.period}-01`).toLocaleDateString("en-GB", { month: "short" }),
      insurance: p.totalInsurance,
      zinara: p.totalZinara,
    }));

  const boothStatus = ["active", "pending", "suspended"]
    .map((s, i) => ({
      name: s.charAt(0).toUpperCase() + s.slice(1),
      value: booths.filter((b) => b.status === s).length,
      color: BOOTH_COLORS[i],
    }))
    .filter((d) => d.value > 0);

  const boothSeries = booths.slice(0, 5).map((b, i) => ({
    month: b.name.split(" ")[0],
    value: b.assistantsCount,
    fill: BOOTH_COLORS[i % BOOTH_COLORS.length],
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-9 gap-1.5 text-[13px]" asChild>
            <Link href="/app/reports">
              <Download className="size-4" aria-hidden /> Download Report
            </Link>
          </Button>
          <Button className="h-9 gap-1.5 text-[13px]" asChild>
            <Link href="/app/submissions?new=1">
              <Plus className="size-4" aria-hidden /> New Submission
            </Link>
          </Button>
        </div>
      </div>

      {/* Financial metrics — 2x2 on phones, 4 across from md up */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Insurance"
          value={<MoneyValue amount={m?.totalInsurance ?? 0} currency={m?.currency} />}
          icon={CreditCard}
          iconTone="primary"
          deltaPct={pct(m?.totalInsurance, prev?.totalInsurance)}
        />
        <MetricCard
          label="Total ZINARA"
          value={<MoneyValue amount={m?.totalZinara ?? 0} currency={m?.currency} />}
          icon={Receipt}
          iconTone="success"
          deltaPct={pct(m?.totalZinara, prev?.totalZinara)}
        />
        <MetricCard
          label="Total Deposits"
          value={<MoneyValue amount={m?.totalDeposits ?? 0} currency={m?.currency} />}
          icon={Banknote}
          iconTone="violet"
          deltaPct={pct(m?.totalDeposits, prev?.totalDeposits)}
        />
        <MetricCard
          label="Closing Position"
          value={<MoneyValue className="text-destructive" amount={m?.closingPosition ?? 0} currency={m?.currency} />}
          icon={Wallet}
          iconTone="danger"
          deltaPct={pct(m?.closingPosition, prev?.closingPosition)}
          negativeGood
        />
      </div>

      {/* Performance chart + collections donut */}
      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title="Monthly Performance"
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
          {perfSeries.length ? (
            <TrendChart
              data={perfSeries}
              series={[
                { key: "insurance", label: "Insurance", color: "var(--color-brand-600)" },
                { key: "zinara", label: "ZINARA", color: "var(--color-brand-300)" },
              ]}
              height={250}
            />
          ) : (
            <p className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">
              No reconciliation data yet — it appears after your first processed import.
            </p>
          )}
        </ChartCard>

        <ChartCard title="Booths by Status" className="lg:col-span-5">
          {boothStatus.length ? (
            <>
              <DonutChart
                data={boothStatus}
                height={170}
                center={
                  <>
                    <span className="tnum text-[20px] font-bold tracking-tight">
                      {booths.length}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Booths</span>
                  </>
                }
              />
              <ul className="mt-2 space-y-1.5 px-3 pb-1">
                {boothStatus.map((b) => (
                  <li key={b.name} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: b.color }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-muted-foreground">{b.name}</span>
                    <span className="tnum font-semibold">
                      {booths.length ? Math.round((b.value / booths.length) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">
              No booths registered yet.
            </p>
          )}
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

        <ChartCard title="Assistants per Booth" className="lg:col-span-5">
          {boothSeries.length ? (
            <BarsChart
              data={boothSeries}
              series={[{ key: "value", label: "Assistants", color: "var(--color-brand-600)" }]}
              height={210}
            />
          ) : (
            <p className="px-4 py-16 text-center text-[12.5px] text-muted-foreground">
              No booths registered yet.
            </p>
          )}
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
