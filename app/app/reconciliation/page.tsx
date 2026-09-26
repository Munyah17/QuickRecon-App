import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getReconciliations, getTransactions, getReconciliationDocuments, getExceptions } from "@/lib/data";
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
  const [rows, transactions, documents, exceptions] = await Promise.all([
    getReconciliations(),
    getTransactions(),
    getReconciliationDocuments(),
    getExceptions(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reconciliation"
        description="Work the batch: verify, flag, resolve alarms, then approve and publish per-agent documents."
      />
      <ReconciliationTabs
        activeTab={tab ?? "workbench"}
        rows={rows}
        transactions={transactions}
        documents={documents}
        exceptions={exceptions}
        canEditCells={session.user.role === "super_admin"}
      />
    </div>
  );
}
