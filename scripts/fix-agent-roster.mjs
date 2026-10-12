/**
 * Cleans the agent roster workbook ("Quick Recon - Agent Template.xlsx") into
 * the shape /api/agents/import expects:
 *
 *   Full Name | Email | Phone | Province | Location | National ID |
 *   IceCash ID | Modules | Status | Zinara User | NMB | NMB USD | CBZ | NBS | FBC
 *
 * What it fixes:
 *  - renames/reorders headers to the importer's column names
 *  - merges duplicate agent names, unioning their bank/Zinara codes
 *  - drops blank rows and the stray "Icecash" label row
 *  - derives a name from "ZW… - NAME" for rows that only carry a Zinara User
 *  - trims whitespace everywhere
 *  - warns when the same code is claimed by two different agent names
 *    (the importer keeps the first; the second agent loses that alias)
 *
 * Usage:
 *   node scripts/fix-agent-roster.mjs [path-to-xlsx]
 */
import * as XLSX from "xlsx";
import { copyFileSync } from "node:fs";
import * as fs from "node:fs";

// The ESM build of SheetJS doesn't auto-wire Node's fs module.
XLSX.set_fs(fs);

const SRC =
  process.argv[2] ??
  "C:/Users/MeXa/Downloads/Quick Recon - Agent Template.xlsx";

const wb = XLSX.readFile(SRC);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

const cell = (row, ...names) => {
  for (const n of names)
    for (const k of Object.keys(row))
      if (k.trim().toLowerCase() === n.toLowerCase()) return row[k];
  return null;
};

const splitCodes = (v) =>
  v == null ? [] : String(v).split(/[;,]/).map((s) => s.trim()).filter(Boolean);

const titleCase = (s) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

/** name (UPPER) -> merged record */
const agents = new Map();
let skipped = 0;
let derived = 0;

for (const r of rows) {
  let name = String(cell(r, "Name", "Full Name", "Agent Name") ?? "").trim();
  const zinara = splitCodes(cell(r, "Zinara User", "ZINARA User"));

  // Rows with no name but a "CODE - HOLDER NAME" Zinara value: the holder
  // name is the best available agent name.
  if (!name && zinara.length) {
    const dash = zinara[0].indexOf(" - ");
    if (dash > 0 && zinara[0].slice(dash + 3).trim()) {
      name = titleCase(zinara[0].slice(dash + 3).trim());
      derived++;
    }
  }
  if (!name || /^icecash$/i.test(name)) {
    skipped++;
    continue;
  }

  const key = name.toUpperCase();
  const rec =
    agents.get(key) ??
    {
      name: titleCase(name),
      zinara: new Set(),
      nmb: new Set(),
      nmbUsd: new Set(),
      cbz: new Set(),
      nbs: new Set(),
      fbc: new Set(),
    };
  agents.set(key, rec);

  for (const v of zinara) rec.zinara.add(v);
  for (const v of splitCodes(cell(r, "NMB"))) rec.nmb.add(v);
  for (const v of splitCodes(cell(r, "NMB USD"))) rec.nmbUsd.add(v);
  for (const v of splitCodes(cell(r, "CBZ"))) rec.cbz.add(v);
  for (const v of splitCodes(cell(r, "NBS"))) rec.nbs.add(v);
  for (const v of splitCodes(cell(r, "FBC"))) rec.fbc.add(v);
}

// Cross-name conflicts: the same code claimed under two different names.
const claims = new Map(); // "scheme|value" -> agent name
const conflicts = [];
for (const rec of agents.values()) {
  for (const [scheme, set] of [
    ["Zinara User", rec.zinara],
    ["NMB", rec.nmb],
    ["NMB USD", rec.nmbUsd],
    ["CBZ", rec.cbz],
    ["NBS", rec.nbs],
    ["FBC", rec.fbc],
  ]) {
    for (const v of set) {
      // also index the bare Zinara code, matching the importer's behaviour
      const variants = [v];
      const dash = v.indexOf(" - ");
      if (scheme === "Zinara User" && dash > 0) variants.push(v.slice(0, dash).trim());
      for (const val of variants) {
        const k = `${scheme}|${val.toUpperCase()}`;
        const prev = claims.get(k);
        if (prev && prev !== rec.name) {
          conflicts.push(`${scheme} "${val}" → ${prev} AND ${rec.name}`);
        } else {
          claims.set(k, rec.name);
        }
      }
    }
  }
}

const sorted = [...agents.values()].sort((a, b) => a.name.localeCompare(b.name));

const out = sorted.map((a) => ({
  "Full Name": a.name,
  Email: null,
  Phone: null,
  Province: null,
  Location: null,
  "National ID": null,
  "IceCash ID": null,
  Modules: "both",
  Status: "active",
  "Zinara User": [...a.zinara].join("; ") || null,
  NMB: [...a.nmb].join("; ") || null,
  "NMB USD": [...a.nmbUsd].join("; ") || null,
  CBZ: [...a.cbz].join("; ") || null,
  NBS: [...a.nbs].join("; ") || null,
  FBC: [...a.fbc].join("; ") || null,
}));

const outWs = XLSX.utils.json_to_sheet(out);
outWs["!cols"] = [
  { wch: 26 }, { wch: 26 }, { wch: 15 }, { wch: 12 }, { wch: 14 },
  { wch: 15 }, { wch: 11 }, { wch: 9 }, { wch: 9 },
  { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
];
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, outWs, "AGENTS");

copyFileSync(SRC, SRC.replace(/\.xlsx$/i, " (original).xlsx"));
let outPath = SRC;
try {
  XLSX.writeFile(outWb, outPath);
} catch (e) {
  if (e?.code !== "EBUSY") throw e;
  // Source is open in Excel — write a sibling file instead of failing.
  outPath = SRC.replace(/\.xlsx$/i, " (fixed).xlsx");
  XLSX.writeFile(outWb, outPath);
}

console.log(`Read ${rows.length} rows from ${SRC}`);
console.log(`Fixed workbook written to: ${outPath}`);
console.log(`Agents after merge: ${out.length}`);
console.log(`Names derived from Zinara holder name: ${derived}`);
console.log(`Rows skipped (blank/junk): ${skipped}`);
if (conflicts.length) {
  console.log("\nCode conflicts across different names (first wins at import):");
  for (const c of conflicts) console.log(`  - ${c}`);
}
console.log(`Backup of the untouched source: "...(original).xlsx".`);
