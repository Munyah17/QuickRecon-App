import type { NormalizedRecord, SourceAdapter, SourceRow } from "./types";

/** ---------------- helpers shared by adapters ---------------- */

function cell(row: SourceRow, ...names: string[]): unknown {
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (k.trim().toLowerCase() === n.toLowerCase()) return row[k];
    }
  }
  return undefined;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toCurrency(v: unknown): "ZWG" | "USD" {
  const s = String(v ?? "").toUpperCase();
  return s.includes("USD") || s.includes("US$") || s === "$" ? "USD" : "ZWG";
}

function toDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && v.trim()) return v.slice(0, 10);
  return undefined;
}

function makeRecord(
  sheetName: string,
  rowIndex: number,
  row: SourceRow,
  category: NormalizedRecord["category"],
  idKeys: string[],
  amountKeys: string[],
  refKeys: string[]
): NormalizedRecord {
  const externalIdRaw = cell(row, ...idKeys);
  const externalId = externalIdRaw != null ? String(externalIdRaw).trim() : undefined;
  const nameHint = cell(row, "Agent", "Agent Name", "Name");
  return {
    externalId: externalId || undefined,
    agentNameHint: nameHint != null ? String(nameHint).trim() : undefined,
    category,
    amount: toNumber(cell(row, ...amountKeys)),
    currency: toCurrency(cell(row, "Currency", "Curr")),
    reference: String(cell(row, ...refKeys) ?? `${sheetName}:${rowIndex}`),
    date: toDate(cell(row, "Date", "Txn Date", "Transaction Date")),
    sourceSheet: sheetName,
    sourceRow: rowIndex,
  };
}

const AGENT_ID_KEYS = ["Agent ID", "AgentID", "Agent Code", "AgentCode", "Code"];
const NAME_FALLBACK_KEYS = ["Agent", "Agent Name", "Name"];

/** ---------------- Enpassent adapter ---------------- */

export const enpassentAdapter: SourceAdapter = {
  module: "enpassent",
  supportsSheet(name) {
    return /insurance|zinara|deposit|summary|transactions/i.test(name);
  },
  normalise(sheetName, rows) {
    const isInsurance = /insur|summary|transactions/i.test(sheetName);
    const isZinara = /zinara/i.test(sheetName);
    const isDeposit = /deposit|settlement|bank/i.test(sheetName);
    const category: NormalizedRecord["category"] = isDeposit
      ? "deposit"
      : isZinara
        ? "zinara"
        : isInsurance
          ? "insurance"
          : "adjustment";

    const amountKeys = isDeposit
      ? ["Amount", "Deposit", "Settled", "Value"]
      : ["Amount", "Premium", "Value", "Total"];

    return rows
      .map((row, i) =>
        makeRecord(sheetName, i, row, category, [...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS], amountKeys, [
          "Ref",
          "Reference",
          "Policy No",
          "Receipt No",
        ])
      )
      .filter((r) => r.amount !== 0 || r.externalId);
  },
};

/** ---------------- Econet Moovah adapter ---------------- */

export const econetMoovahAdapter: SourceAdapter = {
  module: "econet-moovah",
  supportsSheet(name) {
    return /insurance|zinara|deposit|pos|float/i.test(name);
  },
  normalise(sheetName, rows) {
    const isDeposit = /deposit|pos|float/i.test(sheetName);
    const isZinara = /zinara/i.test(sheetName);
    const category: NormalizedRecord["category"] = isDeposit
      ? "deposit"
      : isZinara
        ? "zinara"
        : "insurance";
    return rows
      .map((row, i) =>
        makeRecord(
          sheetName,
          i,
          row,
          category,
          ["Econet ID", "EcoCash ID", "MSISDN", ...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS],
          ["Amount", "Float", "Value", "Total"],
          ["Ref", "Reference", "Txn Ref", "Transaction Ref"]
        )
      )
      .filter((r) => r.amount !== 0 || r.externalId);
  },
};

export const ADAPTERS: SourceAdapter[] = [enpassentAdapter, econetMoovahAdapter];

export function adapterFor(module: string): SourceAdapter {
  return ADAPTERS.find((a) => a.module === module) ?? enpassentAdapter;
}
