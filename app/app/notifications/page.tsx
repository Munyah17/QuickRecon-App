import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getNotifications } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const notifications = await getNotifications(!isCompanyRole(session.user.role));

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Notifications"
        description={`${unread} unread update${unread === 1 ? "" : "s"}`}
        actions={<Button variant="outline" size="sm" className="text-[12.5px]">Mark all read</Button>}
      />

      <Card className="gap-0 py-0 shadow-xs">
        <CardContent className="divide-y p-0">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <span className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg ${n.read ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"}`}>
                <Bell className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDistanceToNowStrict(parseISO(n.at), { addSuffix: true })}
                </p>
              </div>
              {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
