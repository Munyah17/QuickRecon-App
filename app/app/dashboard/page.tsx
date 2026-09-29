import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  getActivities,
  getAdminDashboardSummary,
  getAgentById,
  getAgents,
  getBooths,
  getReconciliations,
} from "@/lib/data";
import type { AgentPeriodMetrics } from "@/types";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = isCompanyRole(session.user.role);
  const activities = await getActivities(!company);

  if (company) {
    const summary = await getAdminDashboardSummary();
    return (
      <AdminDashboard
        firstName={session.user.fullName.split(" ")[0]}
        activities={activities}
        summary={summary}
      />
    );
  }

  const agentId = session.user.agentId ?? "AGT-000184";
  const agent = (await getAgentById(agentId)) ?? (await getAgents())[0];
  if (!agent) redirect("/login");
  const booths = await getBooths(agent.id);

  // Roll the agent's reconciliations up into per-period totals for the
  // metric cards and performance chart.
  const recons = await getReconciliations({ agentId: agent.id });
  const byPeriod = new Map<string, AgentPeriodMetrics>();
  for (const r of recons) {
    const bucket = byPeriod.get(r.period) ?? {
      period: r.period,
      currency: r.currency,
      totalInsurance: 0,
      totalZinara: 0,
      totalDeposits: 0,
      closingPosition: 0,
    };
    bucket.totalInsurance += r.insurance;
    bucket.totalZinara += r.zinara;
    bucket.totalDeposits += r.deposits;
    bucket.closingPosition += r.closingPosition;
    byPeriod.set(r.period, bucket);
  }
  const periodMetrics = [...byPeriod.values()].sort((a, b) =>
    b.period.localeCompare(a.period)
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AgentDashboard
      agent={agent}
      booths={booths}
      activities={activities}
      greeting={greeting}
      periodMetrics={periodMetrics}
    />
  );
}
