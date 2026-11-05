// Diagnostic: find where "Stanbic"/"Nedbank"/"TNC" live in staged import data.
// Scans staging_rows.raw and reconciliation_documents payloads, printing the
// worksheet, row, and the COLUMN the value was under. Run: node scripts/diag-bank-leak.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const NEEDLE = /stanbic|nedbank|\btnc\b|\bfbc\b|\bcabs\b|\bposb\b|agribank/i;
const hits = new Map(); // worksheet -> Map(col -> Set(value))
let scanned = 0;

for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("staging_rows")
    .select("worksheet,row_number,raw")
    .range(from, from + 999);
  if (error) { console.error("staging_rows:", error.message); break; }
  if (!data?.length) break;
  scanned += data.length;
  for (const row of data) {
    const raw = row.raw ?? {};
    for (const [col, v] of Object.entries(raw)) {
      const s = String(v ?? "");
      if (NEEDLE.test(s)) {
        if (!hits.has(row.worksheet)) hits.set(row.worksheet, new Map());
        const m = hits.get(row.worksheet);
        if (!m.has(col)) m.set(col, new Set());
        m.get(col).add(s.slice(0, 60));
      }
    }
  }
  if (data.length < 1000) break;
}

console.log(`scanned ${scanned} staged rows\n`);
if (!hits.size) console.log("No Stanbic/Nedbank/TNC/CABS/FBC/POSB/Agribank strings in staged data.");
for (const [sheet, cols] of hits) {
  console.log(`Worksheet: "${sheet}"`);
  for (const [col, vals] of cols) {
    console.log(`  column "${col}" -> ${[...vals].slice(0, 4).join(" | ")}${vals.size > 4 ? ` (+${vals.size - 4} more)` : ""}`);
  }
}

// Same search inside persisted reconciliation documents.
const { data: docs, error: dErr } = await sb
  .from("reconciliation_documents")
  .select("id,agent_id,period")
  .limit(500);
if (!dErr && docs?.length) {
  const docHits = [];
  for (const d of docs) {
    const { data: full } = await sb.from("reconciliation_documents").select("*").eq("id", d.id).single();
    if (full && NEEDLE.test(JSON.stringify(full))) {
      const s = JSON.stringify(full);
      const m = s.match(NEEDLE);
      docHits.push(`${d.agent_id} ${d.period} -> ...${s.slice(Math.max(0, m.index - 40), m.index + 40)}...`);
    }
  }
  console.log(`\nreconciliation_documents containing those names: ${docHits.length}`);
  docHits.slice(0, 5).forEach((h) => console.log("  " + h));
}
