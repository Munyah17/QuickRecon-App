import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { ERPDashboard } from "@/components/erp/erp-dashboard";

export const metadata: Metadata = { title: "ERP" };

export default async function ERPPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  return (
    <div className="space-y-4">
      <PageHeader
        title="ERP System"
        description="Accounting, HR, sales, POS and invoice management"
      />
      <ERPDashboard />
    </div>
  );
}
