import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTransactions } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionsList } from "@/components/transactions/transactions-list";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Field users see only their own transactions — never the whole ledger.
  const company = isCompanyRole(session.user.role);
  const transactions = await getTransactions(company ? undefined : session.user.agentId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description={company ? "All reconciled transactions" : "Your reconciled transactions"}
      />
      <TransactionsList transactions={transactions} />
    </div>
  );
}
