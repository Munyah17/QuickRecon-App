import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getReconciliations } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { BatchActions, BatchReview } from "@/components/reconciliation/batch-review";

export const metadata: Metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/reports");

  const rows = await getReconciliations();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Reconciliation Results"
        description="Review and approve reconciliation before publishing"
        actions={
          <>
            <Link
              href="/app/reconciliation/exceptions"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-[13px] font-medium hover:bg-surface-hover"
            >
              <TriangleAlert className="size-4 text-warning" aria-hidden />
              Exception Centre
            </Link>
            <BatchActions />
          </>
        }
      />
      <BatchReview rows={rows} />
    </div>
  );
}
