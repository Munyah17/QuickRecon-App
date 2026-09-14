"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, Settings, UserRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { QuickReconMark } from "@/components/shared/logo";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { MoreSheet } from "./more-sheet";
import { isCompanyRole } from "@/lib/nav";
import type { AppNotification, AppUser } from "@/types";

/**
 * Sticky top bar matching the mockups.
 * Desktop: [agent: search] | bell · theme · avatar+name+role.
 * Mobile: hamburger (More sheet) · QR logo · bell · avatar.
 * Module/period selectors intentionally live at page level.
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
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 lg:h-15 lg:px-6">
        {/* Mobile: hamburger + brand */}
        <div className="flex items-center gap-1 lg:hidden">
          <MoreSheet user={user} pinnedHrefs={[]}>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2">
              <Menu className="size-5" />
            </Button>
          </MoreSheet>
          <Link href="/app/dashboard" className="flex items-center gap-2" aria-label="QuickRecon App — home">
            <QuickReconMark size={28} />
            <span className="text-[14px] font-bold tracking-tight">QuickRecon App</span>
          </Link>
        </div>

        {/* Desktop search (field users use the search-led header in mockups) */}
        {!company && (
          <div className="relative hidden w-full max-w-sm lg:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search transactions, reports…"
              className="h-9 bg-card pl-9 text-[13px]"
              aria-label="Search"
            />
          </div>
        )}

        <div className="flex-1" />

        <NotificationsBell notifications={notifications} />
        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 w-auto gap-2 px-1.5" aria-label="Account menu">
              <AgentAvatar name={user.fullName} size="sm" />
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-[13px] font-semibold">{user.fullName}</span>
                <span className="block text-[11px] text-muted-foreground">{user.roleLabel}</span>
              </span>
              <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" aria-hidden />
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
