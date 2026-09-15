"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navForRole, AGENT_MOBILE_PRIMARY } from "@/lib/nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/shared/agent-avatar";
import { ThemeToggle } from "./theme-toggle";
import type { AppUser } from "@/types";

function active(pathname: string, href: string): boolean {
  if (href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
  return pathname.startsWith(href);
}

/**
 * The "More" drawer (bottom sheet) used by mobile bottom nav and the
 * mobile hamburger. Lists everything not pinned to the bottom bar.
 */
export function MoreSheet({
  user,
  pinnedHrefs,
  children,
}: {
  user: AppUser;
  pinnedHrefs: readonly string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const all = navForRole(user.role);
  const items = all.filter((i) => !pinnedHrefs.includes(i.href));
  const [open, setOpen] = React.useState(false);

  const signOut = async () => {
    setOpen(false);
    document.cookie = "qr_preview_role=; Max-Age=0; path=/";
    router.push("/login");
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-4">
        <SheetHeader className="px-5 pb-2">
          <SheetTitle className="text-left text-[15px]">More</SheetTitle>
        </SheetHeader>
        <div className="max-h-[65vh] space-y-0.5 overflow-y-auto px-3">
          {items.map((item) => {
            const isOn = active(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium",
                  isOn ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <item.icon
                  className={cn("size-[19px]", isOn ? "text-primary" : "text-muted-foreground")}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-destructive"
          >
            <LogOut className="size-[19px]" aria-hidden />
            Log out
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between border-t px-5 pt-3">
          <div className="flex items-center gap-2.5">
            <AgentAvatar name={user.fullName} size="sm" />
            <div className="leading-tight">
              <p className="text-[13px] font-semibold">{user.fullName}</p>
              <p className="text-[11px] text-muted-foreground">{user.roleLabel}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { AGENT_MOBILE_PRIMARY };
