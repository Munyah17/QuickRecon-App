import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBooths } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { MyBooths } from "@/components/agents/my-booths";
import { isCompanyRole } from "@/lib/nav";

export const metadata: Metadata = { title: "My Booths" };

export default async function BoothsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (isCompanyRole(session.user.role)) redirect("/app/agents");

  const booths = await getBooths(session.user.agentId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Booths"
        description="View and manage your booths/locations"
      />
      <MyBooths booths={booths} />
    </div>
  );
}
