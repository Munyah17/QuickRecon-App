"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Settings, UserRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { QuickReconMark } from "@/components/shared/logo";
import { ModuleSelector } from "@/components/shared/module-selector";
import { PeriodSelector } from "@/components/shared/period-selector";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { isCompanyRole } from "@/lib/nav";
import type { AppNotification, AppUser } from "@/types";

/**
 * Sticky top bar matching the mockups.
 * Company (desktop): navy band — user chip + bell + settings gear.
 * Agent (desktop): white band — navy brand pill, segmented module pills,
 *   period selector, bell, user chip.
 * Mobile (both): hamburger · QR logo · bell · avatar.
 */
export function Topbar({
  user,
  notifications,
}: {
  user: AppUser;
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const company = isCompanyRole(user.role);

  const signOut = async () => {
    document.cookie = "qr_preview_role=; Max-Age=0; path=/";
    router.push("/login");
    router.refresh();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        company
          ? "border-border bg-background/85 lg:border-sidebar-border lg:bg-sidebar lg:text-sidebar-foreground"
          : "border-border bg-background/85"
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 lg:h-15 lg:px-6">
        {/* Mobile: hamburger → left slide-in nav drawer */}
        <div className="flex items-center gap-1 lg:hidden">
          <MobileNavDrawer user={user}>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2">
              <Menu className="size-5" />
            </Button>
          </MobileNavDrawer>
          <Link href="/app/dashboard" className="flex items-center gap-2" aria-label="QuickRecon App — home">
            <QuickReconMark size={28} />
            <span className="text-[14px] font-bold tracking-tight">QuickRecon App</span>
          </Link>
        </div>

        {/* Agent desktop: navy brand pill + segmented module pills (mockup 1) */}
        {!company && (
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/app/dashboard"
              aria-label="QuickRecon App — home"
              className="flex h-10 items-center gap-2 rounded-xl bg-sidebar px-3 text-sidebar-foreground"
            >
              <QuickReconMark size={22} />
              <span className="text-[13.5px] font-bold tracking-tight">QuickRecon App</span>
            </Link>
            <ModuleSelector allowAll={false} variant="segmented" />
          </div>
        )}

        <div className="flex-1" />

        {/* Agent desktop: period selector before the user chip (mockup 1) */}
        {!company && (
          <div className="hidden lg:block">
            <PeriodSelector align="end" />
          </div>
        )}

        <NotificationsBell notifications={notifications} />
        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        {/* Company: settings gear (mockup 2) */}
        {company && (
          <Button variant="ghost" size="icon" asChild aria-label="Settings" className="hidden lg:inline-flex">
            <Link href="/app/settings">
              <Settings className="size-[18px]" aria-hidden />
            </Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 w-auto gap-2 px-1.5" aria-label="Account menu">
              <AgentAvatar name={user.fullName} size="sm" />
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-[13px] font-semibold">{user.fullName}</span>
                <span
                  className={cn(
                    "block text-[11px] text-muted-foreground",
                    company && "lg:text-sidebar-foreground/70"
                  )}
                >
                  {user.roleLabel}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "hidden size-3.5 text-muted-foreground md:block",
                  company && "lg:text-sidebar-foreground/70"
                )}
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-[13px] font-semibold">{user.fullName}</p>
              <p className="text-[11.5px] font-normal text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile" className="gap-2">
                <UserRound className="size-4" aria-hidden /> My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" className="gap-2">
                <Settings className="size-4" aria-hidden /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="gap-2 text-destructive focus:text-destructive">
              <LogOut className="size-4" aria-hidden /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
