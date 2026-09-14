import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { WorkspaceProvider } from "@/components/workspace-provider";
import type { AppNotification, AppUser, ModuleCode } from "@/types";

/**
 * Responsive application shell.
 * Desktop: fixed left sidebar + sticky top bar + fluid content column.
 * Mobile: brand top bar + content + safe-area bottom navigation.
 */
export function AppShell({
  user,
  notifications,
  availableModules,
  children,
}: {
  user: AppUser;
  notifications: AppNotification[];
  availableModules: ModuleCode[];
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider availableModules={availableModules}>
      <div className="flex min-h-screen">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} notifications={notifications} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-24 sm:px-5 lg:px-6 lg:pb-10 xl:px-8">
            {children}
          </main>
          <MobileBottomNav user={user} />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
