import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getNotifications } from "@/lib/data";
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
  const [session, notifications] = await Promise.all([
    getSession(),
    getNotifications().catch((err) => {
      console.error("[AppLayout] Notifications error:", err);
      return [];
    }),
  ]);
  if (!session) redirect("/login");

  // Field roles have no portal access — every session is company staff,
  // which sees all workspace modules.
  const availableModules = ALL_MODULES;

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
