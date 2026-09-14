import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDistributions, getReports } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { MyReports } from "@/components/reports/my-reports";
import { ReportDistribution } from "@/components/reports/report-distribution";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (isCompanyRole(session.user.role)) {
    const history = await getDistributions();
    return (
      <div className="space-y-4">
        <PageHeader
          title="Generate & Send Reports"
          description="Create and distribute reconciled reports to agents"
        />
        <ReportDistribution history={history} />
      </div>
    );
  }

  const reports = await getReports(session.user.agentId);
  return (
    <div className="space-y-4">
      <PageHeader
        title="My Reports"
        description="View and download your reconciled reports"
      />
      <MyReports reports={reports} />
    </div>
  );
}
