import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { runCycle, CYCLE_MODULES } from "@/lib/reconciliation/run-cycle";
import type { ModuleCode } from "@/types";

export const runtime = "nodejs";
// A full cycle re-runs the engine for every agent — allow serverless to breathe.
export const maxDuration = 60;

/**
 * POST /api/reconciliation/run
 * Runs a reconciliation cycle over retained source data — no re-upload.
 * Body: { module?: "enpassent" | "econet-moovah" | "all", period?: "YYYY-MM" }
 * Defaults: all modules, current month (1st → present day).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const moduleCode = (body?.module ?? "all") as ModuleCode | "all";
  const now = new Date();
  const period =
    typeof body?.period === "string" && /^\d{4}-\d{2}$/.test(body.period)
      ? body.period
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const modules: ModuleCode[] = moduleCode === "all" ? CYCLE_MODULES : [moduleCode];
  if (!CYCLE_MODULES.includes(moduleCode as ModuleCode) && moduleCode !== "all") {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const results = [];
  for (const m of modules) {
    results.push(await runCycle(sb, { module: m, period, actorId: session.user.id }));
  }

  const done = results.filter((r) => r.status === "done");
  return NextResponse.json({
    success: done.length > 0,
    period,
    results,
  });
}
