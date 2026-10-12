import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getActivities, getAdminDashboardSummary } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Field roles have no portal access — hard guard in case a stale
  // session or preview cookie slips through.
  if (!isCompanyRole(session.user.role)) redirect("/login");

  const [summary, activities] = await Promise.all([
    getAdminDashboardSummary(),
    getActivities(),
  ]);

  return (
    <AdminDashboard
      firstName={session.user.fullName.split(" ")[0]}
      activities={activities}
      summary={summary}
    />
  );
}
