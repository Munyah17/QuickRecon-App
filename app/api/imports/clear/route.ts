import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Scope = "all" | "uploads" | "runs";

/**
 * POST /api/imports/clear
 * Wipes prior import + run artifacts so an operator can re-import the same
 * workbooks without colliding with history. Runs are purged first —
 * reconciliation batches can reference import batches, and deliveries /
 * documents / reports FK into the recon tables.
 *
 * Body: { scope?: "all" | "uploads" | "runs", module?: ModuleCode | "all" }
 *   scope=uploads → import_batches + staging + worksheets + normalised rows
 *   scope=runs    → reconciliations, documents, exceptions, reports, runs,
 *                   recon batches, deliveries
 *   scope=all     → both (default)
 *   module scopes every delete; "all" wipes every module.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permissionsForRole(session.user.role).includes("imports.delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const scope: Scope = ["uploads", "runs", "all"].includes(body?.scope)
    ? body.scope
    : "all";
  const module = typeof body?.module === "string" && body.module ? body.module : "all";

  const service = await createServiceClient();
  if (!service) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Pre-fetch scoping ids when limiting to one module.
  let importBatchIds: string[] | null = null;
  let reconBatchIds: string[] | null = null;
  let reconAgentIds: string[] | null = null;
  if (module !== "all") {
    const [{ data: ib }, { data: rb }, { data: rc }] = await Promise.all([
      service.from("import_batches").select("id").eq("module", module),
      service.from("reconciliation_batches").select("id").eq("module", module),
      service.from("reconciliations").select("agent_id").eq("module", module),
    ]);
    importBatchIds = (ib ?? []).map((r) => r.id);
    reconBatchIds = (rb ?? []).map((r) => r.id);
    reconAgentIds = [...new Set((rc ?? []).map((r) => r.agent_id).filter(Boolean))];
  }

  type DelResult = { error: { message: string } | null; count: number | null };
  const nothing: Promise<DelResult> = Promise.resolve({ error: null, count: 0 });

  /** table.delete() — no filter fn means "every row" (id is never null). */
  const del = (
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apply?: (q: any) => any
  ): PromiseLike<DelResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = service.from(table).delete({ count: "exact" });
    q = apply ? apply(q) : q.not("id", "is", null);
    return q;
  };
  /** IN-scope to fetched ids; empty id list short-circuits to a no-op. */
  const delIn = (table: string, column: string, ids: string[] | null): PromiseLike<DelResult> =>
    ids === null
      ? del(table)
      : ids.length === 0
        ? nothing
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          del(table, (q: any) => q.in(column, ids));
  /** eq-scope on a module column, or every row when module === "all". */
  const delModule = (table: string): PromiseLike<DelResult> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module === "all" ? del(table) : del(table, (q: any) => q.eq("module", module));

  const steps: { label: string; run: () => PromiseLike<DelResult> }[] = [];

  if (scope !== "uploads") {
    // ── Run artifacts, children first ─────────────────────────────────
    steps.push(
      { label: "reconciliation_deliveries", run: () => delIn("reconciliation_deliveries", "batch_id", reconBatchIds) },
      { label: "reconciliation_documents", run: () => delIn("reconciliation_documents", "batch_id", reconBatchIds) },
      // Exceptions hang off agents, not batches — scope via the module's
      // reconciled agents when narrowing to one module.
      {
        label: "reconciliation_exceptions",
        run: () => delIn("reconciliation_exceptions", "agent_id", reconAgentIds),
      },
      { label: "reports", run: () => delModule("reports") },
      { label: "reconciliations", run: () => delModule("reconciliations") },
      { label: "reconciliation_runs", run: () => delModule("reconciliation_runs") },
      { label: "reconciliation_batches", run: () => delModule("reconciliation_batches") }
    );
  }

  if (scope !== "runs") {
    // ── Upload artifacts ──────────────────────────────────────────────
    steps.push(
      { label: "staging_rows", run: () => delIn("staging_rows", "batch_id", importBatchIds) },
      { label: "import_worksheets", run: () => delIn("import_worksheets", "batch_id", importBatchIds) },
      { label: "normalised_records", run: () => delIn("normalised_records", "batch_id", importBatchIds) },
      { label: "import_batches", run: () => delModule("import_batches") }
    );
  }

  const deleted: Record<string, number> = {};
  const failed: Record<string, string> = {};
  for (const step of steps) {
    const { error, count } = await step.run();
    if (error) failed[step.label] = error.message;
    else deleted[step.label] = count ?? 0;
  }

  await service.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "imports.cleared",
    entity: "import_batch",
    entity_id: scope,
    metadata: { scope, module, deleted, failed },
  });

  if (Object.keys(failed).length > 0) {
    return NextResponse.json(
      { error: `Some tables could not be cleared: ${Object.keys(failed).join(", ")}`, deleted, failed },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, scope, module, deleted });
}
