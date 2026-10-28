"use client";

import {
  Upload,
  RefreshCcw,
  FileBarChart,
  Users,
  UserRound,
  TriangleAlert,
  ClipboardCheck,
} from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import type { ActivityItem, ActivityKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  import: Upload,
  reconciliation: RefreshCcw,
  report: FileBarChart,
  agent: Users,
  profile: UserRound,
  exception: TriangleAlert,
  submission: ClipboardCheck,
};

const KIND_TONE: Record<ActivityKind, string> = {
  import: "bg-primary-soft text-primary",
  reconciliation: "bg-info-soft text-info-foreground",
  report: "bg-success-soft text-success-foreground",
  agent: "bg-primary-soft text-primary",
  profile: "bg-muted text-muted-foreground",
  exception: "bg-destructive-soft text-destructive",
  submission: "bg-warning-soft text-warning-foreground",
};

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y">
      {items.map((item) => {
        // Fallbacks: an unmapped kind must never render `undefined` (React #130).
        const Icon = KIND_ICON[item.kind] ?? UserRound;
        const tone = KIND_TONE[item.kind] ?? "bg-muted text-muted-foreground";
        return (
          <li key={item.id} className="flex items-start gap-3 px-1 py-3 first:pt-0 last:pb-0">
            <span
              className={cn(
                "mt-0.5 flex size-7.5 shrink-0 items-center justify-center rounded-lg",
                tone
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{item.title}</p>
              {item.description ? (
                <p className="truncate text-[12px] text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            <time className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
              {relativeTime(item.at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
