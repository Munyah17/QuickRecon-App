/**
 * Validate a reconciliation workbook end-to-end against its own RECON tab.
 *
 * Usage:  node --experimental-strip-types scripts/validate-upload.mjs <file.xlsx>
 *
 * Runs the real enpassent adapter over every sheet, resolves records through
 * the identities the RECON tab defines (the same codes /api/agents/import now
 * writes to agent_external_ids), then diffs the engine-level aggregates
 * against the operator's per-agent totals.
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { adapterFor } from "../lib/reconciliation/adapters.ts";
import { IdentityResolver } from "../lib/reconciliation/identity-resolver.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: node --experimental-strip-types scripts/validate-upload.mjs <file.xlsx>");
  process.exit(1);
}

const wb = XLSX.read(readFileSync(file), { type: "buffer", cellDates: true });
const sheet = (name) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name] ?? {}, { defval: null });

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const txt = (v) => String(v ?? "").trim();
const key = (s) => s.toUpperCase().replace(/\s+/g, " ").trim();
const bareCode = (v) => txt(v).split(" - ")[0].trim();

/* ---------- RECON ground truth: agents, aliases, expected columns ---------- */

const recon = sheet("RECON");
const agents = new Map(); // agentName -> expected cols
const aliases = []; // {scheme,value,agentId}

recon.forEach((r, i) => {
  const agent = txt(r[" Agent"] ?? r["Agent"]);
  if (!agent) return;
  const id = `AGT-${String(i + 1).padStart(6, "0")}`;
  agents.set(key(agent), {
    id,
    zinara: num(r[" Zinara"] ?? r["Zinara"]),
    netInsurance: num(r[" Net insurance "] ?? r["Net insurance"]),
    nmb: num(r[" NMB"] ?? r["NMB"]),
    nbs: num(r[" NBS"] ?? r["NBS"]),
    nbsUsd: num(r[" NBS USD TO ZIG"] ?? r["NBS USD TO ZIG"]),
    cbz: num(r[" CBZ_1"] ?? r["CBZ_1"]),
    transfers: num(r[" Transfers"] ?? r["Transfers"]),
    usdDeposits: num(r[" USD Deposits"] ?? r["USD Deposits"]),
    nmbUsd: num(r[" NMB USD_1"] ?? r["NMB USD_1"]),
    alterations: num(r[" Alterations"] ?? r["Alterations"]),
    opening: num(r[" Balance B/d "] ?? r["Balance B/d"]),
    variance: num(r[" Variance"] ?? r["Variance"]),
  });
  const codes = {
    zinara_user: txt(r[" ZINARA "] ?? r["ZINARA"]),
    nmb: txt(r[" NMB "] ?? r["NMB "]),
    nmb_usd: txt(r[" NMB USD"] ?? r["NMB USD"]),
    nbs: txt(r[" NBS "] ?? r["NBS "]),
    cbz: txt(r[" CBZ"] ?? r["CBZ"]),
  };
  for (const [scheme, raw] of Object.entries(codes)) {
    if (!raw) continue;
    for (const v of new Set([raw, bareCode(raw)])) {
      aliases.push({ scheme, value: v, agentId: id });
    }
  }
});

const resolver = new IdentityResolver(aliases);
const nameIndex = new Map([...agents].map(([n, a]) => [n, a.id]));

/* ---------- normalise every sheet through the real adapter ---------- */

const adapter = adapterFor("enpassent");
const matched = [];
const perSheet = [];
let skippedRows = 0;
for (const name of wb.SheetNames) {
  const rows = sheet(name);
  if (!adapter.supportsSheet(name) || rows.length === 0) {
    skippedRows += rows.length;
    perSheet.push(`  SKIP ${name} (${rows.length} rows)`);
    continue;
  }
  const recs = adapter.normalise(name, rows);
  let m = 0;
  for (const rec of recs) {
    const res = resolver.resolve(rec);
    let agentId = res.agentId;
    if (!agentId && rec.agentNameHint) agentId = nameIndex.get(rec.agentNameHint.toUpperCase());
    if (!agentId && rec.externalId) agentId = nameIndex.get(rec.externalId.toUpperCase());
    if (agentId) {
      m++;
      matched.push({ ...rec, agentId });
    }
  }
  const sum = recs.reduce((s, r) => s + r.amount, 0);
  perSheet.push(`  OK   ${name}: ${recs.length}/${rows.length} records, matched=${m}, sum=${sum.toFixed(0)}`);
}
console.log("=== per-sheet normalise ===\n" + perSheet.join("\n"));
console.log(`records matched: ${matched.length}, skipped rows: ${skippedRows}`);

/* ---------- aggregate per agent + category ---------- */

const agg = new Map();
for (const r of matched) {
  const a = agg.get(r.agentId) ?? { insurance: 0, commission: 0, zinara: 0, deposits: 0, adjustments: 0, banks: {} };
  if (r.category === "insurance") {
    a.insurance += r.amount;
    a.commission += r.commission ?? 0;
  } else if (r.category === "zinara") a.zinara += r.amount;
  else if (r.category === "deposit") {
    a.deposits += r.amount;
    const b = r.bankAccount ?? "Other";
    a.banks[b] = (a.banks[b] ?? 0) + r.amount;
  } else if (r.category === "adjustment") a.adjustments += r.amount;
  agg.set(r.agentId, a);
}

const fmt = (n) => n.toFixed(0).padStart(10);
function diff(label, expected, actual) {
  const bad = [];
  let n = 0;
  for (const [name, t] of agents) {
    const a = agg.get(t.id);
    const exp = expected(t);
    const got = actual(a, t);
    if (exp === 0 && got === 0) continue;
    n++;
    if (Math.abs(exp - got) >= 1)
      bad.push(`  DIFF ${name.padEnd(26)} ${fmt(exp)} ${fmt(got)} ${fmt(got - exp)}`);
  }
  console.log(`\n== ${label} == ${n - bad.length}/${n} matching`);
  console.log(bad.slice(0, 12).join("\n") || "  all matching");
  if (bad.length > 12) console.log(`  … ${bad.length - 12} more`);
}

diff("Zinara (E+F)", (t) => t.zinara, (a) => a?.zinara ?? 0);
diff("Net insurance (prem − comm)", (t) => t.netInsurance, (a) => (a ? a.insurance - a.commission : 0));
diff("NMB deposits", (t) => t.nmb, (a) => a?.banks["NMB"] ?? 0);
diff("NBS deposits", (t) => t.nbs, (a) => a?.banks["NBS"] ?? 0);
diff("CBZ deposits (RECON leaves 0)", (t) => t.cbz, (a) => a?.banks["CBZ"] ?? 0);
diff("Transfers+Ecocash deposits", (t) => t.transfers, (a) => a?.banks["Ecocash"] ?? 0);
diff("Alterations (negated)", (t) => t.alterations, (a) => a?.adjustments ?? 0);
diff("All deposits", (t) => t.nmb + t.nbs + t.nbsUsd + t.cbz + t.transfers + t.usdDeposits + t.nmbUsd, (a) => a?.deposits ?? 0);
diff("Variance (expected−deposits+adj)", (t) => t.variance, (a, t) =>
  t.netInsurance + t.zinara + t.opening - (a?.deposits ?? 0) + (a?.adjustments ?? 0));
console.log("\nDone.");
