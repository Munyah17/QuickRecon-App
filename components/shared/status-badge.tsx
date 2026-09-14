import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CircleCheck,
  Clock,
  CircleX,
  TriangleAlert,
  PauseCircle,
  Send,
  LoaderCircle,
} from "lucide-react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "pending";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success-foreground border-transparent",
  warning: "bg-warning-soft text-warning-foreground border-transparent",
  danger: "bg-destructive-soft text-destructive border-transparent",
  info: "bg-info-soft text-info-foreground border-transparent",
  neutral: "bg-muted text-muted-foreground border-transparent",
  pending: "bg-warning-soft text-warning-foreground border-transparent",
};

/** Maps domain statuses to a visual tone + icon + label. */
const STATUS_MAP: Record<string, { tone: Tone; label: string; icon?: React.ComponentType<{ className?: string }> }> = {
  active: { tone: "success", label: "Active", icon: CircleCheck },
  verified: { tone: "success", label: "Verified", icon: CircleCheck },
  success: { tone: "success", label: "Success", icon: CircleCheck },
  completed: { tone: "success", label: "Completed", icon: CircleCheck },
  published: { tone: "info", label: "Published", icon: Send },
  approved: { tone: "success", label: "Approved", icon: CircleCheck },
  resolved: { tone: "success", label: "Resolved", icon: CircleCheck },
  sent: { tone: "success", label: "Sent", icon: CircleCheck },
  pending: { tone: "pending", label: "Pending", icon: Clock },
  under_review: { tone: "info", label: "Under Review", icon: LoaderCircle },
  processing: { tone: "info", label: "Processing", icon: LoaderCircle },
  review: { tone: "info", label: "In Review", icon: Clock },
  investigating: { tone: "info", label: "Investigating", icon: Clock },
  scheduled: { tone: "info", label: "Scheduled", icon: Clock },
  warning: { tone: "warning", label: "Warning", icon: TriangleAlert },
  attention: { tone: "danger", label: "Attention", icon: CircleX },
  failed: { tone: "danger", label: "Failed", icon: CircleX },
  rejected: { tone: "danger", label: "Rejected", icon: CircleX },
  suspended: { tone: "danger", label: "Suspended", icon: PauseCircle },
  inactive: { tone: "neutral", label: "Inactive" },
  ignored: { tone: "neutral", label: "Ignored" },
  open: { tone: "warning", label: "Open", icon: TriangleAlert },
  in_progress: { tone: "info", label: "In Progress", icon: LoaderCircle },
  awaiting_user: { tone: "warning", label: "Awaiting User", icon: Clock },
  closed: { tone: "neutral", label: "Closed" },
  uploaded: { tone: "info", label: "Uploaded", icon: Clock },
  validating: { tone: "info", label: "Validating", icon: LoaderCircle },
  validated: { tone: "info", label: "Validated", icon: CircleCheck },
  unverified: { tone: "warning", label: "Unverified", icon: TriangleAlert },
  generating: { tone: "info", label: "Generating", icon: LoaderCircle },
  available: { tone: "success", label: "Ready", icon: CircleCheck },
  partial: { tone: "warning", label: "Partial", icon: TriangleAlert },
  matched: { tone: "success", label: "Matched" },
  variance: { tone: "warning", label: "Variance", icon: TriangleAlert },
  missing: { tone: "danger", label: "Missing", icon: CircleX },
  extra: { tone: "info", label: "Extra" },
  insurance: { tone: "info", label: "Insurance" },
  zinara: { tone: "warning", label: "ZINARA" },
  deposit: { tone: "success", label: "Deposit" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const conf = STATUS_MAP[status] ?? { tone: "neutral" as Tone, label: status };
  const Icon = conf.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-[22px] gap-1 rounded-full px-2 text-[11px] font-medium",
        TONE_CLASSES[conf.tone],
        className
      )}
    >
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {conf.label}
    </Badge>
  );
}
