import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getActivities,
  getAgentById,
  getBooths,
  getReconciliations,
} from "@/lib/data";
import { AgentProfile } from "@/components/agents/agent-profile";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "Agent Profile" };

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { agentId } = await params;
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const agent = await getAgentById(agentId);
  if (!agent) notFound();

  const [booths, reconciliations, activities] = await Promise.all([
    getBooths(agent.id),
    getReconciliations({ agentId: agent.id }),
    getActivities(),
  ]);

  return (
    <AgentProfile
      agent={agent}
      booths={booths}
      reconciliations={reconciliations}
      activities={activities}
      viewer={session.user}
    />
  );
}
