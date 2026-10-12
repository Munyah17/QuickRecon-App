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
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    // Parenthesised negatives are standard accounting notation: (1,234.56).
    const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
    // Strip everything except digits, the first decimal point and sign —
    // covers "1,234.56", "1 234.56", "$1,234", "ZWG 1 234.00".
    const cleaned = s.replace(/[()\s$,A-Za-z]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
  }
  return 0;
}

function toCurrency(v: unknown): "ZWG" | "USD" {
  const s = String(v ?? "").toUpperCase();
  return s.includes("USD") || s.includes("US$") || s === "$" ? "USD" : "ZWG";
}

/** Excel serial epoch: 1899-12-30 (matches the 1900 date system's off-by-one). */
function excelSerialToISO(n: number): string | undefined {
  if (n < 1 || n > 60000) return undefined;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function toDate(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // XLSX.read without cellDates leaves dates as serial numbers.
    return excelSerialToISO(v);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    // ISO-ish: 2026-08-15 or 2026/08/15
    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    // DD/MM/YYYY or DD-MM-YYYY — Zimbabwean workbooks are day-first.
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmy) {
      const [, dd, mm, yy] = dmy;
      const day = Number(dd), month = Number(mm);
      if (day <= 31 && month <= 12) {
        const year = yy.length === 2 ? `20${yy}` : yy;
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
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
  const nameHint = cell(row, "Agent", "Agent Name", "Agent Full Name", "Sales Agent", "Name");
  const commission = category === "insurance" ? toNumber(cell(row, "Commission", "Comm", "Commission Amount")) : undefined;
  const bankAccount = category === "deposit" ? String(cell(row, "Account", "Bank", "Account Name", "Channel", "Bank Account") ?? "").trim() || undefined : undefined;
  const usdRaw = category === "deposit" ? cell(row, "USD", "USD Amount", "USD Deposit") : undefined;
  const usdAmount = usdRaw != null ? toNumber(usdRaw) : undefined;
  const conversionRaw = cell(row, "USD- ZWG Conversion", "Conversion", "Rate", "Exchange Rate");
  const usdConversionRate = conversionRaw != null ? toNumber(conversionRaw) : undefined;
  const narration = String(cell(row, "Narration", "Narration /Ref", "Ref", "Description") ?? "").trim() || undefined;
  const str = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : undefined);
  const rtaRaw = category === "insurance" ? cell(row, "RTA", "RTA Amount", "Rta") : undefined;
  return {
    externalId: externalId || undefined,
    agentNameHint: nameHint != null ? String(nameHint).trim() : undefined,
    category,
    amount: toNumber(cell(row, ...amountKeys)),
    currency: toCurrency(cell(row, "Currency", "Curr")),
    reference: String(cell(row, ...refKeys) ?? `${sheetName}:${rowIndex}`),
    date: toDate(cell(row, "Date", "Txn Date", "Transaction Date", "Posting Date", "Sale Date")),
    sourceSheet: sheetName,
    sourceRow: rowIndex,
    commission: commission || undefined,
    bankAccount: bankAccount || undefined,
    usdAmount: usdAmount || undefined,
    usdConversionRate: usdConversionRate || undefined,
    narration: narration || undefined,
    vrn: category === "insurance" || category === "zinara"
      ? str(cell(row, "VRN", "Vehicle Registration", "Reg No", "Registration Number", "Plate"))
      : undefined,
    insuranceCompany: category === "insurance"
      ? str(cell(row, "Insurance Company", "Insurer", "Underwriter", "Insurance Provider"))
      : undefined,
    rtaAmount: rtaRaw != null ? toNumber(rtaRaw) : undefined,
    zinaraAccountId: category === "zinara"
      ? str(cell(row, "ZINARA Account", "ZINARA Account ID", "Account ID", "Zinara ID"))
      : undefined,
    paymentMethod: category === "zinara"
      ? str(cell(row, "Payment Method", "Pay Method", "Method"))
      : undefined,
  };
}

const AGENT_ID_KEYS = ["Agent ID", "AgentID", "Agent Code", "AgentCode", "Code"];
const NAME_FALLBACK_KEYS = ["Agent", "Agent Name", "Name"];

/**
 * Module markers in sheet names. Workbooks ship per-module insurance sheets
 * ("INSURANCE ECO" vs "INSURANCE ENPA") — each adapter must refuse the other
 * module's sheets so an operator selecting the whole workbook can't feed
 * Econet rows into an Enpassent batch (or vice versa).
 */
const ECONET_SHEET = /\beco\b|econet/i;
const ENPASSENT_SHEET = /\benpa\b|enpassent/i;

/** ---------------- Enpassent adapter ---------------- */

export const enpassentAdapter: SourceAdapter = {
  module: "enpassent",
  supportsSheet(name) {
    if (ECONET_SHEET.test(name)) return false;
    return /insurance|zinara|deposit|summary|transactions|alteration|adjust/i.test(name);
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

    // "USD- ZWG Conversion" is a rate column, not an amount — reading it as
    // money silently corrupts deposits when the real Amount column is absent.
    const amountKeys = isDeposit
      ? ["Amount", "Deposit", "Settled", "Settled Amount", "Value", "Deposited"]
      : ["Amount", "Premium", "Premium Collected", "Premium Amount", "Value", "Total"];

    return rows
      .map((row, i) =>
        makeRecord(sheetName, i, row, category, [...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS], amountKeys, [
          "Ref",
          "Reference",
          "Policy No",
          "Receipt No",
          "Narration /Ref",
        ])
      )
      .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
  },
};

/** ---------------- Econet Moovah adapter ---------------- */

export const econetMoovahAdapter: SourceAdapter = {
  module: "econet-moovah",
  supportsSheet(name) {
    if (ENPASSENT_SHEET.test(name)) return false;
    return /insurance|zinara|deposit|pos|float|alteration|adjust/i.test(name);
  },
  normalise(sheetName, rows) {
    const isDeposit = /deposit|pos|float/i.test(sheetName);
    const isZinara = /zinara/i.test(sheetName);
    const isAdjustment = /alteration|adjust/i.test(sheetName);
    const category: NormalizedRecord["category"] = isDeposit
      ? "deposit"
      : isZinara
        ? "zinara"
        : isAdjustment
          ? "adjustment"
          : "insurance";
    return rows
      .map((row, i) =>
        makeRecord(
          sheetName,
          i,
          row,
          category,
          ["Econet ID", "EcoCash ID", "MSISDN", ...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS],
          ["Amount", "Premium Collected", "Premium", "Premium Amount", "Float", "Value", "Total"],
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
