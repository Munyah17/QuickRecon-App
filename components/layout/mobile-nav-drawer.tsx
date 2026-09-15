"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar";
import type { AppUser } from "@/types";

/**
 * Retractable navigation drawer — slides in from the left via the
 * hamburger toggle, showing the full navy sidebar nav on mobile/tablet.
 */
export function MobileNavDrawer({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[272px] flex-col gap-0 border-r-0 bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav user={user} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
