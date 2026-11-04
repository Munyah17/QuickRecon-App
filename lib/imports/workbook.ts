import * as XLSX from "xlsx";
import Papa from "papaparse";
import { HyperFormula } from "hyperformula";
import type { SourceRow } from "@/lib/reconciliation/types";

/**
 * Unified workbook loader for imports.
 *
 * Why this exists: SheetJS returns a formula cell's *cached* value — files
 * written by tools that don't recalculate on save (LibreOffice, Google
 * Sheets exports, ERP dumps) arrive with stale or missing caches, so rows
 * silently imported as empty. We rebuild every sheet into a HyperFormula
 * instance so formulas actually evaluate, falling back to the cached value
 * only when a formula can't be resolved (external refs, _xlfn funcs…).
 * CSV files go through papaparse and become a single-sheet workbook.
 */

export interface ParsedWorkbook {
  sheetNames: string[];
  /** Final value grids (formulas evaluated where possible). */
  grids: Record<string, unknown[][]>;
  /** Formula cell count per sheet — feeds the inspect warnings. */
  formulaCells: Record<string, number>;
  /** Formula cells that had NO cached value and were recovered by eval. */
  recoveredCells: Record<string, number>;
  /** Formula cells that could not be evaluated (error result, no cache). */
  unevaluatedCells: Record<string, number>;
}

const CSV_EXT = /\.(csv|txt|tsv)$/i;

export async function loadWorkbook(
  buffer: Buffer,
  fileName: string
): Promise<ParsedWorkbook> {
  if (CSV_EXT.test(fileName)) {
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<unknown[]>(text, {
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: fileName.toLowerCase().endsWith(".tsv") ? "\t" : "",
    });
    return {
      sheetNames: ["CSV"],
      grids: { CSV: parsed.data as unknown[][] },
      formulaCells: {},
      recoveredCells: {},
      unevaluatedCells: {},
    };
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: true,
    cellDates: true,
  });

  // ── Stage 1: raw grids — formulas as "=…" strings for HF input ──────
  const rawGrids: Record<string, unknown[][]> = {};
  const cachedGrids: Record<string, unknown[][]> = {};
  const formulaCells: Record<string, number> = {};
  const formulaAddr: Record<string, { r: number; c: number }[]> = {};

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    const raw: unknown[][] = [];
    const cached: unknown[][] = [];
    const addrs: { r: number; c: number }[] = [];
    let formulas = 0;

    if (ref) {
      for (let r = ref.s.r; r <= ref.e.r; r++) {
        const rawRow: unknown[] = [];
        const cachedRow: unknown[] = [];
        for (let c = ref.s.c; c <= ref.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell?.f) {
            formulas++;
            addrs.push({ r: raw.length, c: rawRow.length });
            rawRow.push(`=${cell.f}`);
            cachedRow.push(cell.v ?? null);
          } else {
            const v = cell?.v ?? null;
            rawRow.push(v instanceof Date ? v.toISOString().slice(0, 10) : v);
            cachedRow.push(v);
          }
        }
        raw.push(rawRow);
        cached.push(cachedRow);
      }
    }

    rawGrids[name] = raw;
    cachedGrids[name] = cached;
    formulaCells[name] = formulas;
    formulaAddr[name] = addrs;
  }

  // ── Stage 2: evaluate formulas via HyperFormula ─────────────────────
  const grids: Record<string, unknown[][]> = {};
  const recoveredCells: Record<string, number> = {};
  const unevaluatedCells: Record<string, number> = {};
  const total = Object.values(formulaCells).reduce((n, v) => n + v, 0);

  let evaluated: Record<string, unknown[][]> | null = null;
  if (total > 0) {
    try {
      const hf = HyperFormula.buildFromSheets(
        rawGrids as Record<string, (string | number | boolean | null)[][]>,
        { licenseKey: "gpl-v3" }
      );
      evaluated = {};
      for (const name of workbook.SheetNames) {
        const id = hf.getSheetId(name);
        evaluated[name] = id === undefined ? cachedGrids[name] : (hf.getSheetValues(id) as unknown[][]);
      }
      hf.destroy();
    } catch {
      evaluated = null; // HF failed entirely — use cached values (old behaviour)
    }
  }

  for (const name of workbook.SheetNames) {
    const out = evaluated?.[name] ?? cachedGrids[name];
    const grid = out.map((row) => row.slice());
    let recovered = 0;
    let unevaluated = 0;
    for (const { r, c } of formulaAddr[name] ?? []) {
      const v = grid[r]?.[c];
      const cached = cachedGrids[name]?.[r]?.[c] ?? null;
      if (v !== null && typeof v === "object") {
        // DetailedCellError — formula couldn't resolve; keep cached value.
        grid[r][c] = cached;
        if (cached === null) unevaluated++;
      } else if (cached === null && v !== null && v !== undefined) {
        recovered++;
      } else if (v === null || v === undefined) {
        grid[r][c] = cached;
      }
    }
    grids[name] = trimGrid(grid);
    recoveredCells[name] = recovered;
    unevaluatedCells[name] = unevaluated;
  }

  return { sheetNames: workbook.SheetNames, grids, formulaCells, recoveredCells, unevaluatedCells };
}

/** Drop fully-empty trailing rows/columns so header detection isn't skewed. */
function trimGrid(grid: unknown[][]): unknown[][] {
  while (grid.length && grid[grid.length - 1].every((c) => c === null || c === undefined || c === "")) {
    grid.pop();
  }
  return grid;
}

/**
 * Header row detection — real-world workbooks often carry a title banner
 * above the headers. Scan the first rows for the one containing the most
 * recognisable field names; need at least 2 hits to trust it.
 */
const HEADER_HINTS =
  /^(agent|agent\s*(id|code|name|full name|ref(erence)?|number)|name|amount|premium|premium collected|deposit|deposited|settled|settled amount|value|total|date|txn date|transaction date|posting date|value date|sale date|ref|reference|policy no|receipt no|narration|narration \/ref|narrative|details|description|currency|curr|account|account name|bank|bank account|channel|commission|comm|usd|usd amount|usd deposit|rate|conversion|vrn|vehicle registration|reg no|registration number|insurance company|insurer|underwriter|rta|rta amount|payment method|float|msisdn|econet id|ecocash id|code|status|type|credit|creditamount|credit amount|cr amt|cr amount|debit|debit amount|balance|tid|terminal id|terminal|merchant name|agent name|user|transaction type)$/i;

export function headerIndex(grid: unknown[][]): number {
  let headerIdx = 0;
  let best = 0;
  const scan = Math.min(grid.length, 15);
  for (let i = 0; i < scan; i++) {
    const score = (grid[i] ?? []).reduce<number>(
      (n, c) => n + (typeof c === "string" && HEADER_HINTS.test(c.trim()) ? 1 : 0),
      0
    );
    if (score > best) {
      best = score;
      headerIdx = i;
    }
  }
  return best < 2 ? 0 : headerIdx;
}

/**
 * Map a value grid to row objects — same semantics as
 * `sheet_to_json({ defval: null })`: headers become keys, blank header
 * cells become __EMPTY/__EMPTY_1…, fully-empty rows are skipped.
 */
export function gridToRows(grid: unknown[][], headerIdx: number): SourceRow[] {
  const headerRow = grid[headerIdx] ?? [];
  const keys: string[] = [];
  let empties = 0;
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h === null || h === undefined || String(h).trim() === "") {
      keys.push(empties === 0 ? "__EMPTY" : `__EMPTY_${empties}`);
      empties++;
    } else {
      keys.push(String(h).trim());
    }
  }

  // A data row can be wider than the detected header (merged banner cells,
  // trailing notes columns). Extending keys to the widest row keeps those
  // cells instead of silently truncating them.
  const width = Math.max(keys.length, ...grid.map((g) => g.length));
  while (keys.length < width) keys.push(`__EMPTY_${empties++}`);

  const rows: SourceRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const g = grid[r] ?? [];
    const obj: SourceRow = {};
    let has = false;
    for (let c = 0; c < width; c++) {
      const v = g[c] ?? null;
      obj[keys[c]] = v;
      if (v !== null && v !== undefined && v !== "") has = true;
    }
    if (has) rows.push(obj);
  }
  return rows;
}

/** Convenience: header-detected row objects for one sheet. */
export function rowsForSheet(wb: ParsedWorkbook, name: string): SourceRow[] {
  const grid = wb.grids[name] ?? [];
  return gridToRows(grid, headerIndex(grid));
}
