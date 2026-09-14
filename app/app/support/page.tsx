import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTickets } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { SupportClient } from "@/components/support/support-client";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const company = isCompanyRole(session.user.role);
  const tickets = company ? await getTickets() : await getTickets(session.user.agentId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support"
        description={company ? "Triage and resolve agent tickets" : "Raise a ticket or track your requests"}
      />
      <SupportClient tickets={tickets} isCompanyUser={company} />
    </div>
  );
}
