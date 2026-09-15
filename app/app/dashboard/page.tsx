import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  getActivities,
  getAgentById,
  getAgents,
  getBooths,
} from "@/lib/data";
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
    await getAgents(); // warm data access (shows inactive agents, etc. when live)
    return (
      <AdminDashboard
        firstName={session.user.fullName.split(" ")[0]}
        activities={activities}
      />
    );
  }

  const agentId = session.user.agentId ?? "AGT-000184";
  const agent = (await getAgentById(agentId)) ?? (await getAgents())[0];
  const booths = await getBooths(agent.id);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AgentDashboard
      agent={agent}
      booths={booths}
      activities={activities}
      greeting={greeting}
    />
  );
}
