import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPendingApprovals, getTeamUsers } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { UserManagement, AddUserDialog } from "@/components/users/user-management";

export const metadata: Metadata = { title: "Staff Management" };

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const [users, pendingApprovals] = await Promise.all([
    getTeamUsers(),
    getPendingApprovals(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Management"
        description="Manage staff accounts, roles and permissions"
        actions={<AddUserDialog />}
      />
      <UserManagement users={users} pendingApprovals={pendingApprovals} />
    </div>
  );
}
