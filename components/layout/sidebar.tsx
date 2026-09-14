"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole, isCompanyRole } from "@/lib/nav";
import { QuickReconLogo } from "@/components/shared/logo";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import type { AppUser } from "@/types";

function isActive(pathname: string, href: string): boolean {
  if (href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
  return pathname.startsWith(href);
}

/**
 * Deep-navy desktop sidebar (≈232px) matching the QuickRecon PC mockups:
 * logo, primary nav with solid-blue active pill, support, profile footer.
 */
export function Sidebar({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const company = isCompanyRole(user.role);
  const items = navForRole(user.role);
  const support = items.find((i) => i.label === "Support");
  const main = items.filter(
    (i) => i.label !== "Support" && i.label !== "Settings" && i.label !== "My Profile"
  );
  const settings = items.find((i) => i.label === "Settings");

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-15 items-center px-4">
        <Link href="/app/dashboard" aria-label="QuickRecon App — dashboard">
          <QuickReconLogo tone="dark" />
        </Link>
      </div>

      {!company && (
        <p className="px-4 pb-2 text-[10px] font-semibold tracking-[0.14em] text-[#54749c] uppercase">
          Agent Portal
        </p>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto border-t border-sidebar-border px-3 py-3" aria-label="Primary">
        {main.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9.5 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-white/6 hover:text-white"
              )}
            >
              <item.icon className="size-[17px] opacity-90" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        {support ? (
          <Link
            href={support.href}
            aria-current={isActive(pathname, support.href) ? "page" : undefined}
            className={cn(
              "flex h-9.5 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
              isActive(pathname, support.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-white/6 hover:text-white"
            )}
          >
            <LifeBuoy className="size-[17px] opacity-90" aria-hidden />
            Support
          </Link>
        ) : null}
        {settings ? (
          <Link
            href={settings.href}
            aria-current={isActive(pathname, settings.href) ? "page" : undefined}
            className={cn(
              "flex h-9.5 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
              isActive(pathname, settings.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-white/6 hover:text-white"
            )}
          >
            <settings.icon className="size-[17px] opacity-90" aria-hidden />
            Settings
          </Link>
        ) : null}

        {!company ? (
          <div className="mt-2 rounded-xl bg-white/6 p-3">
            <div className="flex items-center gap-2">
              <Headset className="size-4 text-brand-300" aria-hidden />
              <p className="text-[12px] font-semibold text-white">Help &amp; Support</p>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#7f99b8]">
              Questions about reconciliation or payouts? Contact support.
            </p>
            <Link
              href="/app/support"
              className="mt-2 inline-flex h-7 items-center rounded-md bg-white/10 px-2.5 text-[11.5px] font-medium text-white hover:bg-white/15"
            >
              Contact support
            </Link>
          </div>
        ) : null}

        <Link
          href="/app/profile"
          className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/6"
        >
          <AgentAvatar name={user.fullName} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-white">{user.fullName}</p>
            <p className="truncate text-[11.5px] text-[#7f99b8]">{user.roleLabel}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
