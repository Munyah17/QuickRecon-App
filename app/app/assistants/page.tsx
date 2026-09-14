import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAssistants, getBooths, getAgents } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { MyAssistants } from "@/components/agents/my-assistants";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "Assistants" };

export default async function AssistantsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = isCompanyRole(session.user.role);

  if (!company) {
    // Agent view — only their assistants
    const agentId = session.user.agentId;
    const [assistants, booths] = await Promise.all([
      getAssistants(agentId),
      getBooths(agentId),
    ]);

    return (
      <div className="space-y-4">
        <PageHeader
          title="My Assistants"
          description="Manage your assistant accounts. New assistants activate after Super Admin approval."
        />
        <MyAssistants assistants={assistants} booths={booths} />
      </div>
    );
  }

  // Super Admin / Admin view — all assistants across all agents
  const agents = await getAgents();
  const allAssistants = await Promise.all(
    agents.map(async (a) => {
      const asts = await getAssistants(a.id);
      return asts.map((ast) => ({ ...ast, parentAgentName: a.fullName }));
    })
  );
  const assistants = allAssistants.flat();
  const booths = await getBooths();

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Assistants"
        description="View and manage all assistant accounts across agents"
      />
      <MyAssistants assistants={assistants} booths={booths} isAdminView />
    </div>
  );
}
