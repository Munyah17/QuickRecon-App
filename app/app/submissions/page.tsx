import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAgents, getSubmissions, getTasks, getTeamUsers } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionsView } from "@/components/submissions/submissions-view";

export const metadata: Metadata = { title: "Task Management" };

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = isCompanyRole(session.user.role);
  const isAdmin =
    session.user.role === "super_admin" || session.user.role === "admin";

  const [submissions, tasks, agents, staff] = await Promise.all([
    company ? getSubmissions() : getSubmissions(session.user.agentId),
    getTasks(),
    company ? getAgents() : Promise.resolve([]),
    company ? getTeamUsers() : Promise.resolve([]),
  ]);
  const { new: wantsNew } = await searchParams;

  return (
    <div className="space-y-4">
      <PageHeader
        title={company ? "Task Management" : "My Tasks & Submissions"}
        description={
          company
            ? "Assign tasks, track milestones and review submissions"
            : "Your assigned tasks, documents and queries"
        }
      />
      <SubmissionsView
        submissions={submissions}
        tasks={tasks}
        agents={agents.map((a) => ({ id: a.id, fullName: a.fullName }))}
        staff={staff
          .filter((u) => u.role !== "agent" && u.role !== "assistant")
          .map((u) => ({ id: u.id, fullName: u.fullName }))}
        isCompanyUser={company}
        isAdmin={isAdmin}
        startOpen={!company && wantsNew === "1"}
      />
    </div>
  );
}
