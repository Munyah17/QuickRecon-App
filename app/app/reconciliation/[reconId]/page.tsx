import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getReconciliationById,
  getReconciliationLines,
  getTransactions,
} from "@/lib/data";
import { ReconDetail } from "@/components/reconciliation/recon-detail";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "Reconciliation Details" };

export default async function ReconDetailPage({
  params,
}: {
  params: Promise<{ reconId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { reconId } = await params;
  const recon = await getReconciliationById(reconId);
  if (!recon) notFound();

  const company = isCompanyRole(session.user.role);
  // Agents (and assistants) can only open their own reconciliations.
  if (!company && session.user.agentId !== recon.agentId) {
    redirect("/app/dashboard");
  }

  const [lines, transactions] = await Promise.all([
    getReconciliationLines(recon.id),
    getTransactions(recon.agentId),
  ]);

  return (
    <ReconDetail
      recon={recon}
      lines={lines}
      transactions={transactions}
      isCompanyUser={company}
    />
  );
}
