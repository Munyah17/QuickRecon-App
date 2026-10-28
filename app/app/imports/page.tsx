import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAgents, getImportBatches } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { isCompanyRole } from "@/lib/nav";
import { ImportWizard } from "@/components/imports/import-wizard";
import { RecentImports } from "@/components/imports/recent-imports";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const [batches, agents] = await Promise.all([getImportBatches(), getAgents()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import Data"
        description="Upload and process Enpassent or Econet Moovah workbooks"
      />

      <ImportWizard
        agents={agents.map((a) => ({ id: a.id, fullName: a.fullName }))}
      />

      {/* Recent imports — filtered by the active workspace module */}
      <RecentImports batches={batches} />
    </div>
  );
}
