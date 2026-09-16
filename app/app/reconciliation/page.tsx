import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getReconciliations, getTransactions, getReconciliationDocuments } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { ReconciliationTabs } from "@/components/reconciliation/reconciliation-tabs";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/reports");

  const { tab } = await searchParams;
  const [rows, transactions, documents] = await Promise.all([
    getReconciliations(),
    getTransactions(),
    getReconciliationDocuments(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconciliation"
        description="Review consolidated results, then approve and publish per-agent documents."
      />
      <ReconciliationTabs
        activeTab={tab ?? "summary"}
        rows={rows}
        transactions={transactions}
        documents={documents}
        canEditCells={session.user.role === "super_admin"}
      />
    </div>
  );
}
