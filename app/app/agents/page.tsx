import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getAgents } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AgentsTable } from "@/components/agents/agents-table";
import { AddAgentDialog } from "@/components/agents/add-agent-dialog";
import { ModuleSelector } from "@/components/shared/module-selector";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const agents = await getAgents();

  return (
    <div className="space-y-4">
      {/* Mobile module selector (per mobile mockup) */}
      <div className="lg:hidden">
        <ModuleSelector allowAll />
      </div>

      <PageHeader
        title="Agents"
        description="Manage all agents, their profiles, booths and module access"
        actions={
          <>
            <Button variant="outline" className="h-9 gap-1.5 text-[13px]">
              <Download className="size-4 rotate-180" aria-hidden /> Import Agents
            </Button>
            <AddAgentDialog />
          </>
        }
      />

      <AgentsTable agents={agents} />
    </div>
  );
}
