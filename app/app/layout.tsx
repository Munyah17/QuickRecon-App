import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getNotifications, filterFieldNotifications } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { AppShell } from "@/components/layout/app-shell";
import { AIAssistant } from "@/components/shared/ai-assistant";
import type { ModuleCode } from "@/types";

const ALL_MODULES: ModuleCode[] = ["enpassent", "econet-moovah"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Notifications run concurrently with the session lookup — RLS scopes the
  // rows via the auth cookie, so the query doesn't need the resolved session.
  const [session, allNotifications] = await Promise.all([
    getSession(),
    getNotifications(false),
  ]);
  if (!session) redirect("/login");

  // Agents/assistants only see modules their parent agent/account has enabled.
  const availableModules: ModuleCode[] =
    session.user.role === "agent" || session.user.role === "assistant"
      ? ALL_MODULES // resolved per-agent module access once backend is live
      : ALL_MODULES;

  const notifications = isCompanyRole(session.user.role)
    ? allNotifications
    : filterFieldNotifications(allNotifications);

  return (
    <AppShell
      user={session.user}
      notifications={notifications}
      availableModules={availableModules}
    >
      {children}
      <AIAssistant />
    </AppShell>
  );
}
