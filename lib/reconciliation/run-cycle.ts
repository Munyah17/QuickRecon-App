import type { SupabaseClient } from "@supabase/supabase-js";
import { runReconciliationEngine } from "./engine";
import { companyAliasScheme } from "./identity-resolver";
import { generateAgentDocuments, documentToCSV } from "./document";
import type { ModuleCode } from "@/types";
import type { SourceRow } from "./types";

export const CYCLE_MODULES: ModuleCode[] = ["enpassent", "econet-moovah"];

export interface CycleResult {
  module: ModuleCode;
  period: string;
  status: "done" | "skipped" | "failed";
  reason?: string;
  batchId?: string;
  documentCount?: number;
  exceptionCount?: number;
  sourceImportBatchId?: string;
  error?: string;
}

/**
 * Latest import batch for a module+period that still has its source rows
 * staged. Older imports (pre-staging persistence) are skipped — there is
 * nothing left to re-run the engine over.
 */
async function latestStagedImport(
  sb: SupabaseClient,
  module: ModuleCode,
  period: string
): Promise<string | null> {
  const { data: batches } = await sb
    .from("import_batches")
    .select("id, created_at")
    .eq("module", module)
    .eq("period", period)
    .order("created_at", { ascending: false });
  if (!batches?.length) return null;
  const ids = batches.map((b) => b.id);
  const { data: present } = await sb
    .from("staging_rows")
    .select("batch_id")
    .in("batch_id", ids);
  const have = new Set((present ?? []).map((r) => r.batch_id));
  return batches.find((b) => have.has(b.id))?.id ?? null;
}

/** Rebuild the {sheetName: rows[]} map the engine expects from staged rows. */
async function loadStagedSheets(
  sb: SupabaseClient,
  importBatchId: string
): Promise<Record<string, SourceRow[]>> {
  const sheets: Record<string, SourceRow[]> = {};
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb
      .from("staging_rows")
      .select("worksheet, row_number, raw")
      .eq("batch_id", importBatchId)
      .order("worksheet")
      .order("row_number")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`staging_rows read failed: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      (sheets[r.worksheet] ??= []).push(r.raw as SourceRow);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return sheets;
}

/**
 * Run one reconciliation cycle for a module+period: rebuild the workbook
 * sheets from staged import rows, run the engine, then replace the stored
 * documents/recon rows for that module+period so the new engine logic is
 * what downloads and reports reflect.
 *
 * Old batches/deliveries are kept as audit history — only the live doc set
 * and recon queue rows for the module+period are replaced.
 */
export async function runCycle(
  sb: SupabaseClient,
  opts: { module: ModuleCode; period: string; actorId: string }
): Promise<CycleResult> {
  const { module, period, actorId } = opts;
  const base = { module, period };
  try {
    const importBatchId = await latestStagedImport(sb, module, period);
    if (!importBatchId) {
      return {
        ...base,
        status: "skipped",
        reason:
          "No staged source data for this period — re-import the workbook first (imports now retain source rows).",
      };
    }

    const sheets = await loadStagedSheets(sb, importBatchId);

    const [{ data: agentRows }, { data: aliasRows }, { data: moduleRows }] = await Promise.all([
      sb.from("agents").select("id, full_name, opening_position"),
      sb.from("agent_external_ids").select("scheme, value, agent_id"),
      sb.from("agent_modules").select("agent_id, module, enabled").eq("module", module),
    ]);

    // Scope to agents assigned this module — an agent with no row for the
    // module predates module access and is kept for backwards compat.
    const assigned = new Map<string, boolean>();
    for (const m of moduleRows ?? []) assigned.set(m.agent_id, m.enabled);
    const agents = (agentRows ?? [])
      .filter((a) => assigned.get(a.id) !== false)
      .map((a) => ({
        id: a.id,
        fullName: a.full_name,
        openingPosition: Number(a.opening_position) || 0,
      }));
    const aliases = (aliasRows ?? []).map((a) => ({
      scheme: a.scheme,
      value: a.value,
      agentId: a.agent_id,
    }));

    const output = runReconciliationEngine({
      module,
      period,
      sheets,
      agents,
      aliases,
    });
    const batchDocs = generateAgentDocuments(output);

    // Persist agent codes learned from name-matched rows so subsequent runs
    // resolve by alias. Claimed codes are never re-pointed.
    if (output.learnedAliases.length) {
      const { error: learnErr } = await sb.from("agent_external_ids").upsert(
        output.learnedAliases.map((a) => ({
          agent_id: a.agentId,
          scheme: companyAliasScheme(module),
          value: a.value,
        })),
        { onConflict: "scheme,value", ignoreDuplicates: true }
      );
      if (learnErr) console.error("learned alias persist failed:", learnErr.message);
    }

    // Replace the live document set for this module+period so re-issued
    // docs — and only those — are what get downloaded/sent.
    const { error: delDocs } = await sb
      .from("reconciliation_documents")
      .delete()
      .eq("module", module)
      .eq("period", period);
    if (delDocs) console.error("run-cycle doc cleanup failed:", delDocs.message);

    // Replace live recon-queue rows the same way (lines cascade with the row).
    const { error: delRecon } = await sb
      .from("reconciliations")
      .delete()
      .eq("module", module)
      .eq("period", period);
    if (delRecon) console.error("run-cycle recon cleanup failed:", delRecon.message);

    const { error: batchErr } = await sb.from("reconciliation_batches").insert({
      id: batchDocs.batchId,
      module: batchDocs.module,
      period: batchDocs.period,
      import_batch_id: importBatchId,
      created_by: actorId,
      status: "review",
    });
    if (batchErr) {
      return { ...base, status: "failed", error: `reconciliation_batches: ${batchErr.message}`, sourceImportBatchId: importBatchId };
    }

    const batchTag = batchDocs.batchId.slice(-5);
    const reconId = (i: number) =>
      `RCN-${period.replace("-", "")}-${batchTag}-${String(i + 1).padStart(3, "0")}`;
    const reconRows = output.results.map((r, i) => ({
      id: reconId(i),
      batch_id: batchDocs.batchId,
      agent_id: r.agentId,
      module: batchDocs.module,
      period: batchDocs.period,
      status: r.status,
      currency: r.currency,
      opening_position: r.openingPosition,
      insurance: r.insurance,
      zinara: r.zinara,
      deposits: r.deposits,
      adjustments: r.adjustments,
      closing_position: r.closingPosition,
      version: 1,
    }));
    if (reconRows.length) {
      const { error: reconErr } = await sb
        .from("reconciliations")
        .upsert(reconRows, { onConflict: "id" });
      if (reconErr) console.error("run-cycle reconciliations upsert failed:", reconErr.message);
      else {
        const lineRows = output.results.flatMap((r, i) =>
          r.lines.map((l) => ({
            reconciliation_id: reconId(i),
            item: l.item,
            category: l.category,
            expected: l.expected,
            actual: l.actual,
            variance: l.variance,
            status: l.variance === 0 ? "matched" : "variance",
          }))
        );
        if (lineRows.length) {
          const { error: linesErr } = await sb.from("reconciliation_lines").insert(lineRows);
          if (linesErr) console.error("run-cycle lines insert failed:", linesErr.message);
        }
      }
    }

    if (batchDocs.documents.length) {
      const { error: docsErr } = await sb.from("reconciliation_documents").insert(
        batchDocs.documents.map((d) => ({
          batch_id: batchDocs.batchId,
          agent_id: d.agentId,
          agent_name: d.agentName,
          module: d.module,
          period: d.period,
          currency: d.currency,
          opening_variance: d.openingVariance,
          insurance: d.insurance,
          premium_cover: d.premiumCover,
          commission: d.commission,
          net_insurance: d.netInsurance,
          zinara: d.zinara,
          pds: d.pds,
          total_expected: d.totalExpected,
          bank_deposits: d.bankDeposits,
          deposits: d.deposits,
          adjustments: d.adjustments,
          closing_variance: d.closingVariance,
          closing_position: d.closingPosition,
          status: d.status,
          transactions: d.transactions,
          summary_text: d.summaryText,
          csv_text: documentToCSV(d),
          created_at: d.generatedAt,
        }))
      );
      if (docsErr) {
        return { ...base, status: "failed", error: `reconciliation_documents: ${docsErr.message}`, sourceImportBatchId: importBatchId };
      }
    }

    if (output.exceptions.length) {
      const excRows = output.exceptions.map((e, i) => ({
        id: `EXC-${Date.now().toString(36)}-${String(i).padStart(3, "0")}`,
        batch_id: batchDocs.batchId,
        import_batch_id: importBatchId,
        module: e.module,
        agent_id: e.agentId ?? null,
        type: e.type,
        severity: e.severity,
        source_ref: e.sourceRef ?? null,
        description: e.description,
        status: "open",
      }));
      const { error: excErr } = await sb.from("reconciliation_exceptions").insert(excRows);
      if (excErr) console.error("run-cycle exceptions insert failed:", excErr.message);
    }

    return {
      ...base,
      status: "done",
      batchId: batchDocs.batchId,
      documentCount: batchDocs.documents.length,
      exceptionCount: output.exceptions.length,
      sourceImportBatchId: importBatchId,
    };
  } catch (e) {
    return { ...base, status: "failed", error: e instanceof Error ? e.message : "cycle failed" };
  }
}

/** Distinct (module, period) combos that have ever produced documents or imports. */
export async function issuedCombos(
  sb: SupabaseClient
): Promise<{ module: ModuleCode; period: string }[]> {
  const [docs, imports] = await Promise.all([
    sb.from("reconciliation_documents").select("module, period"),
    sb.from("import_batches").select("module, period"),
  ]);
  const seen = new Set<string>();
  const out: { module: ModuleCode; period: string }[] = [];
  for (const row of [...(docs.data ?? []), ...(imports.data ?? [])]) {
    const key = `${row.module}|${row.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ module: row.module as ModuleCode, period: row.period });
  }
  return out.sort((a, b) => a.period.localeCompare(b.period));
}
