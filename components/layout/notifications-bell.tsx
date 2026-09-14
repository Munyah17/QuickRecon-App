"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppNotification } from "@/types";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

export function NotificationsBell({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9.5px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between text-[13px]">
          Notifications
          <span className="text-[11px] font-normal text-muted-foreground">
            {unread} unread
          </span>
        </DropdownMenuLabel>
        {notifications.slice(0, 5).map((n) => (
          <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
            <span className="flex w-full items-center gap-2">
              {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
              <span className="flex-1 truncate text-[13px] font-medium">{n.title}</span>
            </span>
            <span className="line-clamp-2 text-[12px] text-muted-foreground">{n.body}</span>
            <span className="text-[10.5px] text-muted-foreground">
              {formatDistanceToNowStrict(parseISO(n.at), { addSuffix: true })}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild className="justify-center text-[12.5px] font-medium text-primary">
          <Link href="/app/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
