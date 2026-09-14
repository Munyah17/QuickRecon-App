import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getActivities,
  getAgentById,
  getAssistants,
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
  // Agents may only open their own profile; assistants need agents.view-style access.
  if (!isCompanyRole(session.user.role) && session.user.agentId !== agentId) {
    redirect("/app/dashboard");
  }

  const agent = await getAgentById(agentId);
  if (!agent) notFound();

  const [booths, assistants, reconciliations, activities] = await Promise.all([
    getBooths(agent.id),
    getAssistants(agent.id),
    getReconciliations({ agentId: agent.id }),
    getActivities(),
  ]);

  return (
    <AgentProfile
      agent={agent}
      booths={booths}
      assistants={assistants}
      reconciliations={reconciliations}
      activities={activities}
      viewer={session.user}
    />
  );
}
