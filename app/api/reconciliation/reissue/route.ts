import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { runCycle, issuedCombos } from "@/lib/reconciliation/run-cycle";
import type { ModuleCode } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/reconciliation/reissue
 * Re-issues every previously issued reconciliation document: re-runs the
 * engine over the retained source rows for each (module, period) combo and
 * replaces the stored documents with freshly generated ones — so fixes to
 * the engine/adapters/printout reach historical batches.
 *
 * Combos whose imports pre-date source retention are skipped with a reason.
 * Optional body scope: { module?, period? }.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const scopeModule = body?.module as ModuleCode | undefined;
  const scopePeriod = body?.period as string | undefined;

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let combos = await issuedCombos(sb);
  if (scopeModule) combos = combos.filter((c) => c.module === scopeModule);
  if (scopePeriod) combos = combos.filter((c) => c.period === scopePeriod);

  const results = [];
  for (const c of combos) {
    results.push(await runCycle(sb, { module: c.module, period: c.period, actorId: session.user.id }));
  }

  return NextResponse.json({
    success: results.some((r) => r.status === "done"),
    combos: results,
    reissued: results.filter((r) => r.status === "done").length,
    skipped: results.filter((r) => r.status !== "done").length,
  });
}
