import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { runReconciliationEngine } from "@/lib/reconciliation/engine";
import { getAgents, getIdentityAliases } from "@/lib/data";
import type { ModuleCode } from "@/types";
import type { SourceRow } from "@/lib/reconciliation/types";

export const runtime = "nodejs";

/**
 * POST /api/imports/process
 * Re-parses the confirmed workbook, runs the reconciliation engine over the
 * selected worksheets and writes staged results (Supabase when configured;
 * otherwise returns the computed batch for preview).
 *
 * The flow is intentional:
 *   source file  → staging → normalise → match → reconcile → review
 * Nothing here publishes anything.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("imports.process")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const moduleCode = String(form.get("module") ?? "enpassent") as ModuleCode;
  const period = String(form.get("period") ?? "");
  const selectedSheets = String(form.get("sheets") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheets: Record<string, SourceRow[]> = {};
    const sheetNames = selectedSheets.length ? selectedSheets : workbook.SheetNames;
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      sheets[name] = XLSX.utils.sheet_to_json<SourceRow>(sheet, { defval: null });
    }

    const [agents, aliases] = await Promise.all([getAgents(), getIdentityAliases()]);

    const output = runReconciliationEngine({
      module: moduleCode,
      period,
      sheets,
      agents: agents.map((a) => ({ id: a.id, fullName: a.fullName })),
      aliases,
    });

    return NextResponse.json({
      batchId: `IMP-${period.replace("-", "")}-${moduleCode === "enpassent" ? "ENP" : "ECN"}`,
      ...output,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
