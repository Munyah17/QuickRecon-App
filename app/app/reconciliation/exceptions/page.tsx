import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getExceptions } from "@/lib/data";
import { isCompanyRole } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, moduleName } from "@/lib/format";

export const metadata: Metadata = { title: "Alarm" };

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive-soft text-destructive",
  high: "bg-destructive-soft/70 text-destructive",
  medium: "bg-warning-soft text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

export default async function ExceptionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const exceptions = await getExceptions();

  return (
    <div className="space-y-4">
      <Link
        href="/app/reconciliation"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Reconciliation
      </Link>

      <PageHeader
        title="Alarm"
        description="Unmatched identities, variances and schema problems. Nothing is discarded silently — every problematic row lands here."
      />

      <div className="space-y-3">
        {exceptions.map((e) => (
          <Card key={e.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11.5px] text-muted-foreground">{e.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${SEVERITY_STYLE[e.severity]}`}
                  >
                    {e.severity.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10.5px] font-semibold text-info-foreground">
                    {e.type.replaceAll("_", " ")}
                  </span>
                </div>
                <StatusBadge status={e.status} />
              </div>

              <p className="mt-2 text-[13.5px] font-medium">{e.description}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {e.batchId} · {moduleName(e.module)}
                {e.agentName ? ` · ${e.agentName}` : ""}
                {e.sourceRef ? ` · ${e.sourceRef}` : ""} · {formatDate(e.createdAt, "dd MMM HH:mm")}
              </p>

              {e.status !== "resolved" && e.status !== "ignored" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" className="h-8 gap-1.5 text-[12px]">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Resolve
                      </Button>
                    }
                    title="Resolve alarm?"
                    description="Mark as resolved after correcting the mapping or variance. The resolution is audit-logged."
                    confirmLabel="Resolve"
                  />
                  <Button size="sm" variant="outline" className="h-8 text-[12px]">
                    Investigate
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="h-8 text-[12px] text-muted-foreground">
                        Ignore with reason…
                      </Button>
                    }
                    title="Ignore alarm?"
                    description="Ignoring always requires a written reason and is permanent in the audit trail."
                    confirmLabel="Ignore"
                    destructive
                  />
                </div>
              )}
              {e.resolution && (
                <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                  Resolution: {e.resolution}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
