import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { permissionsForRole } from "@/lib/auth/permissions";
import { runReconciliationEngine } from "@/lib/reconciliation/engine";
import { generateAgentDocuments, documentToCSV } from "@/lib/reconciliation/document";
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
  // "all" | a specific agent id — lets the super admin reconcile one agent at a time.
  const agentScope = String(form.get("agent") ?? "all");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Locate the real header row — real-world workbooks often carry a title
    // banner above the headers, and sheet_to_json would treat that banner as
    // the header row and produce garbage __EMPTY keys. Scan the first rows
    // for the one containing the most recognisable field names.
    const HEADER_HINTS = /^(agent|agent\s*(id|code|name|full name)|name|amount|premium|premium collected|deposit|deposited|settled|settled amount|value|total|date|txn date|transaction date|posting date|sale date|ref|reference|policy no|receipt no|narration|narration \/ref|description|currency|curr|account|account name|bank|bank account|channel|commission|comm|usd|usd amount|usd deposit|rate|conversion|vrn|vehicle registration|reg no|registration number|insurance company|insurer|underwriter|rta|rta amount|payment method|float|msisdn|econet id|ecocash id|code|status|type)$/i;
    const sheetRows = (name: string): SourceRow[] => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return [];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        blankrows: false,
      });
      let headerIdx = 0;
      let best = 0;
      const scan = Math.min(grid.length, 15);
      for (let i = 0; i < scan; i++) {
        const cells = (grid[i] ?? []) as unknown[];
        const score = cells.reduce<number>(
          (n, c) => n + (typeof c === "string" && HEADER_HINTS.test(c.trim()) ? 1 : 0),
          0
        );
        if (score > best) { best = score; headerIdx = i; }
      }
      // Need at least 2 known columns to trust it as a header row; otherwise
      // fall back to the default (first row) so unusual sheets still parse.
      if (best < 2) return XLSX.utils.sheet_to_json<SourceRow>(sheet, { defval: null });
      return XLSX.utils.sheet_to_json<SourceRow>(sheet, { defval: null, range: headerIdx });
    };

    const sheets: Record<string, SourceRow[]> = {};
    const sheetNames = selectedSheets.length ? selectedSheets : workbook.SheetNames;
    for (const name of sheetNames) {
      if (!workbook.Sheets[name]) continue;
      sheets[name] = sheetRows(name);
    }

    // Read agents + identity aliases through the service client. This route is
    // already permission-gated (imports.process), and going through the
    // caller's RLS session can silently return zero agents — the engine then
    // reconciles nothing and no documents are produced.
    const { createServiceClient } = await import("@/lib/supabase/server");
    const sb = await createServiceClient();

    let agents: { id: string; fullName: string; openingPosition: number }[] = [];
    let aliases: { scheme: string; value: string; agentId: string }[] = [];
    if (sb) {
      const [{ data: agentRows, error: agentsErr }, { data: aliasRows, error: aliasErr }] =
        await Promise.all([
          sb.from("agents").select("id, full_name, opening_position"),
          sb.from("agent_external_ids").select("scheme, value, agent_id"),
        ]);
      if (agentsErr) console.error("imports/process agents read failed:", agentsErr.message);
      if (aliasErr) console.error("imports/process aliases read failed:", aliasErr.message);
      agents = (agentRows ?? []).map((a) => ({
        id: a.id,
        fullName: a.full_name,
        openingPosition: Number(a.opening_position) || 0,
      }));
      aliases = (aliasRows ?? []).map((a) => ({
        scheme: a.scheme,
        value: a.value,
        agentId: a.agent_id,
      }));
    } else {
      const [mockAgents, mockAliases] = await Promise.all([getAgents(), getIdentityAliases()]);
      agents = mockAgents.map((a) => ({ id: a.id, fullName: a.fullName, openingPosition: 0 }));
      aliases = mockAliases;
    }

    const scopedAgents =
      agentScope === "all" ? agents : agents.filter((a) => a.id === agentScope);
    if (agentScope !== "all" && scopedAgents.length === 0) {
      return NextResponse.json({ error: `Agent ${agentScope} not found` }, { status: 404 });
    }

    if (!period) {
      return NextResponse.json({ error: "Missing period (YYYY-MM)" }, { status: 400 });
    }

    const output = runReconciliationEngine({
      module: moduleCode,
      period,
      sheets,
      agents: scopedAgents.map((a) => ({ id: a.id, fullName: a.fullName, openingPosition: a.openingPosition })),
      aliases,
    });

    const batchDocs = generateAgentDocuments(output);

    // Persist staged documents to Supabase when configured. Every failure is
    // collected and returned so the operator sees that nothing was saved
    // instead of a false "staged successfully".
    const persistenceErrors: string[] = [];
    if (sb) {
      const importId = `IMP-${period.replace("-", "")}-${moduleCode === "enpassent" ? "ENP" : "ECN"}-${Date.now() % 10000}`;
      const { error: impErr } = await sb.from("import_batches").insert({
        id: importId,
        module: moduleCode,
        period,
        file_name: file.name,
        file_size: file.size,
        status: "completed",
        uploaded_by: session.user.id,
      });
      if (impErr) persistenceErrors.push(`import_batches: ${impErr.message}`);

      const { error: batchErr } = await sb.from("reconciliation_batches").insert({
        id: batchDocs.batchId,
        module: batchDocs.module,
        period: batchDocs.period,
        import_batch_id: impErr ? null : importId,
        created_by: session.user.id,
        status: "review",
      });
      if (batchErr) persistenceErrors.push(`reconciliation_batches: ${batchErr.message}`);

      // Per-agent reconciliation rows (batch review reads these). The id
      // embeds a batch suffix — plain RCN-<period>-<seq> collides across
      // batches and the upsert would silently overwrite an older batch.
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
      const { error: reconErr } = await sb
        .from("reconciliations")
        .upsert(reconRows, { onConflict: "id" });
      if (reconErr) persistenceErrors.push(`reconciliations: ${reconErr.message}`);
      else {
        // Replace any stale lines for these recon ids before inserting fresh.
        await sb
          .from("reconciliation_lines")
          .delete()
          .in("reconciliation_id", output.results.map((_, i) => reconId(i)));
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
          if (linesErr) persistenceErrors.push(`reconciliation_lines: ${linesErr.message}`);
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
        if (docsErr) persistenceErrors.push(`reconciliation_documents: ${docsErr.message}`);
      }
    } else {
      persistenceErrors.push(
        "Supabase service client unavailable — results were computed but not saved"
      );
    }

    return NextResponse.json({
      batchId: batchDocs.batchId,
      ...output,
      documents: batchDocs.documents,
      persisted: persistenceErrors.length === 0,
      persistenceErrors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
