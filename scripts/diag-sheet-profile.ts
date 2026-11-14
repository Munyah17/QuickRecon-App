/**
 * READ-ONLY profiler for a staged import batch: what each worksheet holds and
 * what the reconciliation adapters/engine make of it.
 *
 *   npx -y tsx scripts/diag-sheet-profile.ts IMP-202610-ECN-4727
 *
 * Only SELECTs are issued. Customer/owner columns are never printed.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runReconciliationEngine } from "../lib/reconciliation/engine";
import { ADAPTERS } from "../lib/reconciliation/adapters";
import type { NormalizedRecord, SourceRow } from "../lib/reconciliation/types";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const importBatchId = process.argv[2];
const PII = /owner|customer|birth|phone|add\d|town|approved by|cancelled by|cancelled agent/i;
const DATE_COL = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 2 });
const short = (v: unknown, n = 44) => {
  const s = v == null ? "" : String(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && /^-?[\d,.\s]+$/.test(v.trim())) {
    const n = Number(v.replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function tally<T>(items: T[], key: (t: T) => string, val: (t: T) => number = () => 0) {
  const m = new Map<string, { n: number; sum: number }>();
  for (const it of items) {
    const k = key(it);
    const cur = m.get(k) ?? { n: 0, sum: 0 };
    cur.n++;
    cur.sum += val(it);
    m.set(k, cur);
  }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
}

async function main() {
  if (!importBatchId) throw new Error("pass an import batch id");

  const sheets: Record<string, SourceRow[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("staging_rows")
      .select("worksheet, row_number, raw")
      .eq("batch_id", importBatchId)
      .order("worksheet")
      .order("row_number")
      .range(from, from + 999);
    if (error) throw new Error(`staging_rows: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) (sheets[r.worksheet] ??= []).push(r.raw as SourceRow);
    if (data.length < 1000) break;
  }

  const [{ data: agentRows }, { data: aliasRows }] = await Promise.all([
    sb.from("agents").select("id, full_name, opening_position"),
    sb.from("agent_external_ids").select("scheme, value, agent_id"),
  ]);
  console.log(`AGENTS: ${(agentRows ?? []).map((a) => `${a.id} ${a.full_name} (opening ${a.opening_position})`).join(" | ")}`);
  console.log("ALIASES BY SCHEME:");
  for (const [scheme, v] of tally(aliasRows ?? [], (a) => a.scheme)) {
    console.log(`  ${scheme} x${v.n}: ${(aliasRows ?? []).filter((a) => a.scheme === scheme).map((a) => a.value).join(", ")}`);
  }

  for (const [name, rows] of Object.entries(sheets)) {
    console.log(`\n================ "${name}" — ${rows.length} rows ================`);
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const dateKeys = keys.filter((k) => DATE_COL.test(k.trim()));
    const shown = keys.filter((k) => !PII.test(k) && !dateKeys.includes(k));
    console.log(`columns (${keys.length}): ${keys.filter((k) => !dateKeys.includes(k)).join(" | ")}${dateKeys.length ? ` | + ${dateKeys.length} date columns ${dateKeys[0]}..${dateKeys[dateKeys.length - 1]}` : ""}`);

    for (const i of [0, Math.floor(rows.length / 2), rows.length - 1].filter((v, idx, a) => a.indexOf(v) === idx)) {
      const r = rows[i] as Record<string, unknown>;
      console.log(`  row[${i}]: ${shown.filter((k) => r[k] != null && r[k] !== "").map((k) => `${k}=${short(r[k])}`).join(" ; ")}`);
      if (dateKeys.length) {
        const filled = dateKeys.filter((k) => r[k] != null && r[k] !== "");
        console.log(`    date cells filled: ${filled.length}/${dateKeys.length}; e.g. ${filled.slice(0, 4).map((k) => `${k}=${short(r[k], 14)}`).join(", ")}`);
      }
    }

    for (const k of shown) {
      const vals = rows.map((r) => (r as Record<string, unknown>)[k]);
      const filled = vals.filter((v) => v != null && v !== "");
      const nums = filled.map(num).filter((n): n is number => n !== null);
      const distinct = new Set(filled.map((v) => String(v).trim()));
      if (filled.length && nums.length >= filled.length * 0.8 && distinct.size > 12) {
        console.log(`  numeric "${k}": filled ${filled.length}, sum ${fmt(nums.reduce((a, b) => a + b, 0))}, negative ${nums.filter((n) => n < 0).length}, zero ${nums.filter((n) => n === 0).length}`);
      } else if (distinct.size > 0 && distinct.size <= 12) {
        console.log(`  values "${k}" (filled ${filled.length}): ${tally(filled, (v) => String(v).trim()).map(([v, c]) => `${short(v, 28)} x${c.n}`).join(", ")}`);
      } else if (!filled.length) {
        console.log(`  empty "${k}"`);
      }
    }
    if (dateKeys.length) {
      let total = 0, cells = 0;
      for (const r of rows) for (const k of dateKeys) {
        const n = num((r as Record<string, unknown>)[k]);
        if (n !== null) { total += n; cells++; }
      }
      console.log(`  date columns: ${cells} numeric cells, sum ${fmt(total)}`);
    }

    for (const adapter of ADAPTERS) {
      const recs: NormalizedRecord[] = adapter.normalise(name, rows);
      console.log(`  -- ${adapter.module} adapter: supportsSheet=${adapter.supportsSheet(name)}, ${recs.length} records, amount==0: ${recs.filter((r) => r.amount === 0).length}`);
      console.log(`     by category/currency: ${tally(recs, (r) => `${r.category}/${r.currency}`, (r) => r.amount).map(([k, v]) => `${k} x${v.n} = ${fmt(v.sum)}`).join(", ")}`);
      const dep = recs.filter((r) => r.category === "deposit");
      if (dep.length) {
        console.log(`     deposit bankAccount: ${tally(dep, (r) => r.bankAccount ?? "(none)", (r) => r.amount).slice(0, 14).map(([k, v]) => `${short(k, 26)} x${v.n} = ${fmt(v.sum)}`).join(", ")}`);
        const withUsd = dep.filter((r) => r.usdAmount);
        if (withUsd.length) console.log(`     usdAmount set on ${withUsd.length} rows, sum ${fmt(withUsd.reduce((n, r) => n + (r.usdAmount ?? 0), 0))}`);
      }
      const ids = tally(recs, (r) => r.externalId ?? "(none)", (r) => r.amount);
      console.log(`     externalId: ${ids.length} distinct; top: ${ids.slice(0, 5).map(([k, v]) => `${short(k, 26)} x${v.n} = ${fmt(v.sum)}`).join(", ")}`);
      const hints = tally(recs, (r) => r.agentNameHint ?? "(none)");
      console.log(`     agentNameHint: ${hints.length} distinct; top: ${hints.slice(0, 3).map(([k, v]) => `${short(k, 26)} x${v.n}`).join(", ")}`);
      const refs = new Set(recs.map((r) => r.reference));
      console.log(`     distinct references: ${refs.size} of ${recs.length}; e.g. ${[...refs].slice(0, 3).map((r) => short(r, 30)).join(" , ")}`);
    }
  }

  for (const adapter of ADAPTERS) {
    const output = runReconciliationEngine({
      module: adapter.module,
      period: "profile",
      sheets,
      agents: (agentRows ?? []).map((a) => ({ id: a.id, fullName: a.full_name, openingPosition: Number(a.opening_position) || 0 })),
      aliases: (aliasRows ?? []).map((a) => ({ scheme: a.scheme, value: a.value, agentId: a.agent_id })),
    });
    console.log(`\n================ ENGINE (${adapter.module}) ================`);
    const { sheets: _s, ...stats } = output.stats;
    console.log(`stats: ${JSON.stringify(stats)}`);
    const bySheetType = tally(output.exceptions, (e) => `${e.sourceRef.split("!")[0]} :: ${e.type}`);
    for (const [k, v] of bySheetType) console.log(`  exceptions ${k} x${v.n}`);
    const unknown = output.exceptions.filter((e) => e.type === "unknown_external_id");
    for (const [sheet] of tally(unknown, (e) => e.sourceRef.split("!")[0])) {
      const ids = tally(unknown.filter((e) => e.sourceRef.startsWith(`${sheet}!`)), (e) => e.description.match(/"(.*)"/)?.[1] ?? "?");
      console.log(`  unknown ids on "${sheet}": ${ids.length} distinct; top: ${ids.slice(0, 8).map(([k, v]) => `${short(k, 22)} x${v.n}`).join(", ")}`);
    }
    for (const e of output.exceptions.filter((e) => !["unknown_external_id", "duplicate_transaction", "unmatched_agent"].includes(e.type))) {
      console.log(`  [${e.type}] ${short(e.description, 190)}`);
    }
    for (const e of output.exceptions.filter((e) => e.type === "unmatched_agent").slice(0, 4)) console.log(`  [unmatched_agent] ${e.sourceRef} ${short(e.description, 120)}`);
    for (const e of output.exceptions.filter((e) => e.type === "duplicate_transaction").slice(0, 4)) console.log(`  [duplicate] ${e.sourceRef} ${short(e.description, 120)}`);
    for (const r of output.results) {
      console.log(`  RESULT ${r.agentId} ${r.currency}: insurance ${fmt(r.insurance)} | cover(field) ${fmt(r.premiumCover)} | commission ${fmt(r.commission)} | net ${fmt(r.netInsurance)} | zinara ${fmt(r.zinara)} | expected ${fmt(r.totalExpected)} | deposits ${fmt(r.deposits)} | adj ${fmt(r.adjustments)} | closing ${fmt(r.closingVariance)}`);
      console.log(`    bankDeposits ${JSON.stringify(r.bankDeposits)}`);
      console.log(`    transactions by category/currency: ${tally(r.transactions, (t) => `${t.category}/${t.currency}`, (t) => t.amount).map(([k, v]) => `${k} x${v.n} = ${fmt(v.sum)}`).join(", ")}`);
    }
  }
}

main().catch((e) => { console.error("PROFILE FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
