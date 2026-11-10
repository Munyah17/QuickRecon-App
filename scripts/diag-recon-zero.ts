/**
 * READ-ONLY diagnostic: why does an agent's reconciliation show zero
 * insurance/ZINARA, and why does its download 404?
 *
 *   npx -y tsx scripts/diag-recon-zero.ts "Leon" "Panashe"
 *
 * Only SELECTs are issued. The engine is replayed in memory over the staged
 * rows of the import batch behind the agent's latest reconciliation.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runReconciliationEngine } from "../lib/reconciliation/engine";
import { adapterFor } from "../lib/reconciliation/adapters";
import type { SourceRow } from "../lib/reconciliation/types";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tokens = process.argv.slice(2);
const fmt = (n: unknown) => Number(n ?? 0).toLocaleString("en", { maximumFractionDigits: 2 });

async function main() {
  if (!tokens.length) throw new Error("pass one or more name tokens");

  let aq = sb.from("agents").select("id, full_name");
  for (const t of tokens) aq = aq.ilike("full_name", `%${t}%`);
  const { data: agents, error: aErr } = await aq;
  if (aErr) throw new Error(`agents: ${aErr.message}`);
  console.log("AGENTS MATCHED:", (agents ?? []).map((a) => `${a.id} ${a.full_name}`).join(" | ") || "none");
  if (!agents?.length) return;
  const agentIds = agents.map((a) => a.id);

  const { data: recons, error: rErr } = await sb
    .from("reconciliations")
    .select("id, batch_id, agent_id, module, period, currency, insurance, zinara, deposits, adjustments, closing_position")
    .in("agent_id", agentIds)
    .order("period", { ascending: false });
  if (rErr) throw new Error(`reconciliations: ${rErr.message}`);
  console.log("\nRECONCILIATIONS ROWS:");
  for (const r of recons ?? []) {
    console.log(`  ${r.id} | batch ${r.batch_id} | ${r.module} ${r.period} ${r.currency} | ins ${fmt(r.insurance)} zin ${fmt(r.zinara)} dep ${fmt(r.deposits)} adj ${fmt(r.adjustments)} close ${fmt(r.closing_position)}`);
  }

  const { data: docs, error: dErr } = await sb
    .from("reconciliation_documents")
    .select("id, batch_id, agent_id, module, period, currency, insurance, zinara, deposits, bank_deposits, transactions, created_at")
    .in("agent_id", agentIds);
  if (dErr) throw new Error(`reconciliation_documents: ${dErr.message}`);
  console.log(`\nRECONCILIATION_DOCUMENTS ROWS: ${docs?.length ?? 0}`);
  for (const d of docs ?? []) {
    const tx = (typeof d.transactions === "string" ? JSON.parse(d.transactions) : d.transactions ?? []) as { category?: string; amount?: number }[];
    const byCat: Record<string, { n: number; sum: number }> = {};
    for (const t of tx) {
      const c = t.category ?? "?";
      (byCat[c] ??= { n: 0, sum: 0 }).n++;
      byCat[c].sum += Number(t.amount) || 0;
    }
    console.log(`  batch ${d.batch_id} | ${d.module} ${d.period} ${d.currency} | ins ${fmt(d.insurance)} zin ${fmt(d.zinara)} dep ${fmt(d.deposits)}`);
    console.log(`    bank_deposits: ${JSON.stringify(typeof d.bank_deposits === "string" ? JSON.parse(d.bank_deposits) : d.bank_deposits)}`);
    console.log(`    transactions: ${Object.entries(byCat).map(([c, v]) => `${c} x${v.n} = ${fmt(v.sum)}`).join(", ") || "none"}`);
  }

  const { count: agentCount } = await sb.from("agents").select("*", { count: "exact", head: true });
  const { count: aliasCount } = await sb.from("agent_external_ids").select("*", { count: "exact", head: true });
  console.log(`\nAGENTS IN DB: ${agentCount} | ALIASES IN DB: ${aliasCount}`);
  for (const id of agentIds) {
    const { count } = await sb.from("agent_external_ids").select("*", { count: "exact", head: true }).eq("agent_id", id);
    console.log(`  aliases pointing at ${id}: ${count}`);
  }

  const seen = new Set<string>();
  for (const target of recons ?? []) {
    if (seen.has(target.batch_id)) continue;
    seen.add(target.batch_id);
    await replay(target, agentIds);
  }
}

async function replay(target: { id: string; batch_id: string }, agentIds: string[]) {
  console.log("\n==================================================================");
  const { data: batch, error: bErr } = await sb
    .from("reconciliation_batches")
    .select("id, module, period, import_batch_id")
    .eq("id", target.batch_id)
    .maybeSingle();
  if (bErr) throw new Error(`reconciliation_batches: ${bErr.message}`);
  console.log(`\nREPLAYING ${target.id}: batch ${batch?.id} <- import batch ${batch?.import_batch_id}`);
  if (!batch?.import_batch_id) return;

  const sheets: Record<string, SourceRow[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("staging_rows")
      .select("worksheet, row_number, raw")
      .eq("batch_id", batch.import_batch_id)
      .order("worksheet")
      .order("row_number")
      .range(from, from + 999);
    if (error) throw new Error(`staging_rows: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) (sheets[r.worksheet] ??= []).push(r.raw as SourceRow);
    if (data.length < 1000) break;
  }

  const module = batch.module;
  const adapter = adapterFor(module);
  console.log(`\nSTAGED WORKSHEETS (adapter: ${adapter.module}):`);
  for (const [name, rows] of Object.entries(sheets)) {
    console.log(`  "${name}" rows=${rows.length} supportsSheet=${adapter.supportsSheet(name)}`);
    console.log(`    headers: ${Object.keys(rows[0] ?? {}).slice(0, 14).join(" | ")}${Object.keys(rows[0] ?? {}).length > 14 ? " | ..." : ""}`);
    for (const col of Object.keys(rows[0] ?? {}).filter((k) => /^(agent|agent name|user|terminal id|tid|transactor|merchant name)$/i.test(k.trim()))) {
      const freq = new Map<string, number>();
      for (const r of rows) {
        const v = String((r as Record<string, unknown>)[col] ?? "").trim();
        if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
      }
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v} x${n}`).join(", ");
      console.log(`    distinct "${col}": ${freq.size} (top: ${top})`);
    }
  }

  const [{ data: agentRows }, { data: aliasRows }, { data: moduleRows }] = await Promise.all([
    sb.from("agents").select("id, full_name, opening_position"),
    sb.from("agent_external_ids").select("scheme, value, agent_id"),
    sb.from("agent_modules").select("agent_id, module, enabled").eq("module", module),
  ]);
  const assigned = new Map<string, boolean>();
  for (const m of moduleRows ?? []) assigned.set(m.agent_id, m.enabled);
  const output = runReconciliationEngine({
    module,
    period: batch.period,
    sheets,
    agents: (agentRows ?? [])
      .filter((a) => assigned.get(a.id) !== false)
      .map((a) => ({ id: a.id, fullName: a.full_name, openingPosition: Number(a.opening_position) || 0 })),
    aliases: (aliasRows ?? []).map((a) => ({ scheme: a.scheme, value: a.value, agentId: a.agent_id })),
  });

  console.log("\nENGINE SHEET AUDIT (stats.sheets):");
  for (const s of output.stats.sheets) {
    console.log(`  "${s.sheet}" -> ${s.action} | rowsIn ${s.rowsIn} | records ${s.records} | category ${s.category ?? "-"}`);
  }
  const { sheets: _omit, ...restStats } = output.stats;
  console.log("\nENGINE STATS:", JSON.stringify(restStats));

  const learned = output.learnedAliases as unknown;
  console.log(`\nENGINE RESULTS: ${output.results.length} agent-currency results | learnedAliases: ${Array.isArray(learned) ? learned.length : Object.keys((learned ?? {}) as object).length}`);
  for (const r of [...output.results].sort((a, b) => b.recordCount - a.recordCount).slice(0, 5)) {
    console.log(`  ${r.agentId} ${r.agentName} ${r.currency} records ${r.recordCount}`);
  }

  console.log("\nENGINE RESULT FOR AGENT (replayed, not persisted):");
  for (const r of output.results.filter((r) => agentIds.includes(r.agentId))) {
    console.log(`  ${r.currency} | ins ${fmt(r.insurance)} zin ${fmt(r.zinara)} expected ${fmt(r.totalExpected)} dep ${fmt(r.deposits)} adj ${fmt(r.adjustments)} closeVar ${fmt(r.closingVariance)} | records ${r.recordCount}`);
    console.log(`    bankDeposits: ${JSON.stringify(r.bankDeposits)}`);
  }

  const byType: Record<string, number> = {};
  for (const e of output.exceptions) byType[e.type] = (byType[e.type] ?? 0) + 1;
  console.log("\nENGINE EXCEPTIONS BY TYPE:", JSON.stringify(byType));
  for (const e of output.exceptions.filter((e) => e.type === "schema_changed").slice(0, 12)) {
    console.log(`  [${e.severity}] ${e.description.slice(0, 160)}`);
  }
}

main().catch((e) => { console.error("DIAG FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
