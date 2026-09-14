"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LayoutDashboard, Users, RefreshCcw, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCompanyRole, AGENT_MOBILE_PRIMARY } from "@/lib/nav";
import { MoreSheet } from "./more-sheet";
import type { AppUser } from "@/types";

function active(pathname: string, href: string): boolean {
  if (href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
  return pathname.startsWith(href);
}

export const ADMIN_MOBILE_PRIMARY = [
  { label: "Home", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/app/agents", icon: Users },
  { label: "Recon", href: "/app/reconciliation", icon: RefreshCcw },
  { label: "Imports", href: "/app/imports", icon: Upload },
] as const;

/**
 * Mobile bottom navigation (safe-area aware).
 * Field users: Home / Reports / Booths / Submissions / More — per mockups.
 * Company users: Home / Agents / Recon / Imports / More.
 */
export function MobileBottomNav({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const primary = isCompanyRole(user.role) ? ADMIN_MOBILE_PRIMARY : AGENT_MOBILE_PRIMARY;
  const pinned = primary.map((p) => p.href);

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      aria-label="Mobile primary"
    >
      <div className="grid grid-cols-5">
        {primary.map((item) => {
          const isOn = active(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isOn ? "page" : undefined}
              className={cn(
                "flex min-h-[54px] flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium",
                isOn ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-[21px]" aria-hidden />
              <span className="max-w-[72px] truncate">{item.label}</span>
            </Link>
          );
        })}

        <MoreSheet user={user} pinnedHrefs={pinned}>
          <button
            className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium text-muted-foreground"
            aria-label="More options"
          >
            <Ellipsis className="size-[21px]" aria-hidden />
            More
          </button>
        </MoreSheet>
      </div>
    </nav>
  );
}
