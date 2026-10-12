/**
 * Verification harness: transpiles lib/reconciliation/adapters.ts with the
 * project's TypeScript and runs the REAL adapter code against a workbook,
 * printing per-sheet classification + normalised record stats.
 *
 *   node scripts/verify-adapters.mjs [workbook.xlsx]
 */
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import * as ts from "typescript";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

XLSX.set_fs(fs);

const SRC = process.argv[2] ?? "C:/Users/MeXa/Downloads/Agent Dumb (new format).xlsx";

const src = fs.readFileSync("lib/reconciliation/adapters.ts", "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = join(tmpdir(), "adapters-verify.mjs");
fs.writeFileSync(tmp, js);
const { ADAPTERS, adapterFor } = await import(pathToFileURL(tmp).href);

const wb = XLSX.readFile(SRC);
for (const [module, adapter] of [
  ["enpassent", adapterFor("enpassent")],
  ["econet-moovah", adapterFor("econet-moovah")],
]) {
  console.log(`\n=== ${module} ===`);
  for (const name of wb.SheetNames) {
    if (!adapter.supportsSheet(name)) {
      console.log(`  SKIP ${name}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
    const recs = adapter.normalise(name, rows);
    const noId = recs.filter((r) => !r.externalId).length;
    const zeroAmt = recs.filter((r) => !r.amount && !r.usdAmount).length;
    const cats = [...new Set(recs.map((r) => r.category))];
    console.log(
      `  ${name.padEnd(20)} ${String(recs.length).padStart(4)} recs  cats=[${cats}]  ` +
        `noExtId=${noId}  zeroAmount=${zeroAmt}`
    );
  }
}
