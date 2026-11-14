/** READ-ONLY, temporary: row-level probes for a staged import batch. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
type Row = Record<string, unknown>;
const s = (v: unknown, n = 60) => { const t = v == null ? "" : String(v); return t.length > n ? `${t.slice(0, n)}…` : t; };
const n = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[,\s]/g, "")) || 0);
const f = (x: number) => x.toLocaleString("en", { maximumFractionDigits: 2 });
const count = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };

async function main() {
  const sheets: Record<string, Row[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("staging_rows").select("worksheet, row_number, raw").eq("batch_id", process.argv[2]).order("worksheet").order("row_number").range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data) (sheets[r.worksheet] ??= []).push(r.raw as Row);
    if (data.length < 1000) break;
  }
  const { data: aliases } = await sb.from("agent_external_ids").select("scheme, value");
  for (const [scheme] of count((aliases ?? []).map((a) => a.scheme))) {
    console.log(`ALIAS ${scheme}: ${(aliases ?? []).filter((a) => a.scheme === scheme).map((a) => a.value).join(", ")}`);
  }

  const ins = sheets["Insurance Zig"] ?? [];
  const byPolicy = new Map<string, Row[]>();
  for (const r of ins) { const k = String(r["POLICY NO"]); byPolicy.set(k, [...(byPolicy.get(k) ?? []), r]); }
  const cancelled = ins.filter((r) => /^cancelled$/i.test(String(r["STATUS"]).trim()));
  const withTwin = cancelled.filter((r) => (byPolicy.get(String(r["POLICY NO"])) ?? []).length > 1);
  console.log(`\nINSURANCE cancelled rows: ${cancelled.length}; sharing POLICY NO with another row: ${withTwin.length}; premium sum of cancelled ${f(cancelled.reduce((a, r) => a + n(r["PREMIUM COLLECTED"]), 0))}`);
  for (const r of cancelled.slice(0, 3)) {
    console.log(`  cancelled ${r["POLICY NO"]}: ${(byPolicy.get(String(r["POLICY NO"])) ?? []).map((x) => `[ID ${x["ID"]} ${x["STATUS"]} prem ${x["PREMIUM COLLECTED"]} issue ${s(x["ISSUE DATE"], 12)} cancelled ${s(x["CANCELLED DATE"], 10)}]`).join(" ")}`);
  }
  const dupPolicies = [...byPolicy.entries()].filter(([, rs]) => rs.length > 1);
  console.log(`INSURANCE policy numbers appearing more than once: ${dupPolicies.length}`);
  for (const [p, rs] of dupPolicies.slice(0, 5)) {
    console.log(`  ${p}: ${rs.map((x) => `[ID ${x["ID"]} ${x["STATUS"]} prem ${x["PREMIUM COLLECTED"]} issue ${s(x["ISSUE DATE"], 12)} seller ${s(x["AGENT NAME"], 18)}]`).join(" ")}`);
  }
  console.log(`INSURANCE distinct ID values: ${new Set(ins.map((r) => String(r["ID"]))).size} of ${ins.length}`);
  const pds = ins.filter((r) => /^pds$/i.test(String(r["PAYMENT METHOD"]).trim()));
  console.log(`INSURANCE PDS rows: ${pds.length}, premium ${f(pds.reduce((a, r) => a + n(r["PREMIUM COLLECTED"]), 0))}, cover ${f(pds.reduce((a, r) => a + n(r["POLICY COVER"]), 0))}`);

  const nmb = sheets["Nmb Zig"] ?? [];
  const key = (r: Row) => `${r["__EMPTY"]}|${r["Ref. No."]}|${r["CreditAmount"]}`;
  const groups = new Map<string, Row[]>();
  for (const r of nmb) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  const collide = [...groups.values()].filter((g) => g.length > 1);
  console.log(`\nNMB rows sharing code+ref+amount: ${collide.length} groups`);
  for (const g of collide.slice(0, 3)) for (const r of g) console.log(`  code ${r["__EMPTY"]} ref ${r["Ref. No."]} amt ${r["CreditAmount"]} date ${s(r["Transaction Date"], 12)} narr "${s(r["Narration"], 110)}"`);
  const rrn = nmb.map((r) => /RRN:\s*([\d\s]+)/i.exec(String(r["Narration"]))?.[1]?.replace(/\s+/g, "") ?? "");
  console.log(`NMB rows with an RRN in narration: ${rrn.filter(Boolean).length} of ${nmb.length}; distinct RRNs ${new Set(rrn.filter(Boolean)).size}`);
  const noCode = nmb.filter((r) => !/\/([A-Z]?\d{4}T\d{2})/i.test(String(r["Narration"])));
  console.log(`NMB rows without a terminal code in narration: ${noCode.length}`);
  for (const r of noCode.slice(0, 4)) console.log(`  __EMPTY="${r["__EMPTY"]}" amt ${r["CreditAmount"]} narr "${s(r["Narration"], 110)}"`);
  console.log(`NMB "__EMPTY" column agrees with narration code on ${nmb.filter((r) => String(r["Narration"]).toUpperCase().includes(String(r["__EMPTY"] ?? "?").toUpperCase())).length} of ${nmb.length} rows`);

  for (const name of ["POS ZIG", "POS USD"]) {
    const pos = sheets[name] ?? [];
    console.log(`\n${name} BANK x AGENT NAME:`);
    for (const [k, c] of count(pos.map((r) => `${s(r["BANK"], 60)} | ${r["AGENT NAME"]}`))) console.log(`  ${k} x${c}  sum ${f(pos.filter((r) => `${s(r["BANK"], 60)} | ${r["AGENT NAME"]}` === k).reduce((a, r) => a + n(r["AMOUNT"]), 0))}`);
    const tids = new Map<string, Set<string>>();
    for (const r of pos) { const t = String(r["TERMINAL ID"]); tids.set(t, (tids.get(t) ?? new Set()).add(String(r["AGENT NAME"]))); }
    console.log(`  terminals used under more than one agent name: ${[...tids.entries()].filter(([, v]) => v.size > 1).map(([t, v]) => `${t} (${[...v].join(" / ")})`).join(", ") || "none"}`);
    console.log(`  terminals on the other-agent rows: ${[...new Set(pos.filter((r) => !/leon/i.test(String(r["AGENT NAME"]))).map((r) => String(r["TERMINAL ID"])))].join(", ") || "none"}`);
    const dupKey = (r: Row) => `${r["TERMINAL ID"]}|${r["AMOUNT"]}`;
    console.log(`  rows sharing terminal+amount with another row: ${pos.length - new Set(pos.map(dupKey)).size}; distinct TRANSACTOR ${new Set(pos.map((r) => String(r["TRANSACTOR"]))).size} of ${pos.length}`);
  }

  const conv = sheets["USD-ZIG CONVERSIONS"] ?? [];
  console.log(`\nCONVERSIONS by Account (rows | USD amount | ZiG conversion | rows lacking a conversion):`);
  for (const [k, c] of count(conv.map((r) => String(r["Account"] ?? "(blank)").trim().toLowerCase()))) {
    const rs = conv.filter((r) => String(r["Account"] ?? "(blank)").trim().toLowerCase() === k);
    console.log(`  ${k} x${c} | ${f(rs.reduce((a, r) => a + n(r["Amount"]), 0))} | ${f(rs.reduce((a, r) => a + n(r["USD- ZWG Conversion"]), 0))} | ${rs.filter((r) => !(n(r["USD- ZWG Conversion"]) > 0)).length}`);
  }
  for (const r of conv.filter((r) => !(n(r["USD- ZWG Conversion"]) > 0)).slice(0, 5)) console.log(`  no conversion: Amount ${r["Amount"]} Account "${r["Account"] ?? ""}" note "${r["__EMPTY_0"] ?? ""}" ref "${s(r["Narration /Ref"], 40)}" conv "${r["USD- ZWG Conversion"] ?? ""}"`);
  console.log(`  "Narration /Ref" filled ${conv.filter((r) => r["Narration /Ref"] != null && r["Narration /Ref"] !== "").length}; examples: ${[...new Set(conv.map((r) => s(r["Narration /Ref"], 26)).filter(Boolean))].slice(0, 8).join(" ; ")}`);
  const rates = conv.filter((r) => n(r["USD- ZWG Conversion"]) > 0 && n(r["Amount"]) > 0).map((r) => n(r["USD- ZWG Conversion"]) / n(r["Amount"]));
  console.log(`  implied rate (conversion / amount): min ${f(Math.min(...rates))} max ${f(Math.max(...rates))}`);

  const tr = sheets["Transfers and Ecocash"] ?? [];
  console.log(`\nTRANSFERS rows with an Ecocash Reference: ${tr.filter((r) => r["Ecocash Reference"] != null && r["Ecocash Reference"] !== "").length}, by Bank: ${count(tr.filter((r) => r["Ecocash Reference"] != null && r["Ecocash Reference"] !== "").map((r) => String(r["Bank"]).trim())).map(([k, c]) => `${k} x${c}`).join(", ")}`);
}
main().catch((e) => { console.error("PROBE FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
