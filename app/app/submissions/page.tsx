import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSubmissions } from "@/lib/data";
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
  const submissions = company
    ? await getSubmissions()
    : await getSubmissions(session.user.agentId);
  const { new: wantsNew } = await searchParams;

  return (
    <div className="space-y-4">
      <PageHeader
        title={company ? "Submissions" : "My Submissions"}
        description={
          company
            ? "Review agent submissions, documents and queries"
            : "Submit documents, reports and queries"
        }
      />
      <SubmissionsView
        submissions={submissions}
        isCompanyUser={company}
        startOpen={!company && wantsNew === "1"}
      />
    </div>
  );
}
