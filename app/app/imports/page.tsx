import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getAgents, getImportBatches } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { isCompanyRole } from "@/lib/nav";
import { ImportWizard } from "@/components/imports/import-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { fileSizeLabel, formatDate, moduleName } from "@/lib/format";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyRole(session.user.role)) redirect("/app/dashboard");

  const [batches, agents] = await Promise.all([getImportBatches(), getAgents()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import Data"
        description="Upload and process Enpassent or Econet Moovah workbooks"
      />

      <ImportWizard
        agents={agents.map((a) => ({ id: a.id, fullName: a.fullName }))}
      />

      {/* Recent imports */}
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-4 sm:px-5">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/app/imports/${b.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-surface-hover"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-foreground">
                <FileSpreadsheet className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{b.fileName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {fileSizeLabel(b.fileSizeBytes)} · {moduleName(b.module)} ·{" "}
                  {formatDate(b.uploadedAt, "dd MMM yyyy HH:mm")}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
