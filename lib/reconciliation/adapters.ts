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

/** ---------------- bank-statement extractors ----------------
 * Deposit evidence arrives as raw bank statements whose layouts share nothing
 * with the transaction sheets: NMB MPOS lines embed the agent's terminal code
 * in the narration, NBS reports per-terminal TIDs, CBZ lists terminal ids with
 * agent names. Each resolves through agent_external_ids (value match — the
 * importer stores the same codes under the nmb/nbs/cbz schemes). */

const hasCols = (row: SourceRow, ...names: string[]) =>
  names.every((n) =>
    Object.keys(row).some((k) => k.trim().toLowerCase() === n.toLowerCase())
  );

/** MPOS narration embeds the terminal code: ".../N1411T17/Enpasent...". */
const MPOS_CODE = /\/([A-Z]?\d{4}T\d{2})/i;

/** Columns holding the workbook's own USD→ZIG converted value (not a rate). */
const CONVERSION_COLS = [
  "USD - ZIG CONVERSION",
  "USD- ZWG Conversion",
  "Usd to ZIG conversion",
  "USD to ZWG Conversion",
];

/**
 * When a sheet carries its own converted figure, that value is what the ops
 * recon counts — use it as the ZWG amount and keep the USD amount separately.
 * Without one, USD sheets stay USD so the engine flags mixed currency instead
 * of silently summing unconverted figures.
 */
function applyConversion(
  rec: NormalizedRecord,
  row: SourceRow,
  sheetName: string
): NormalizedRecord {
  const conv = toNumber(cell(row, ...CONVERSION_COLS));
  if (conv > 0) {
    return { ...rec, usdAmount: rec.amount, amount: conv, currency: "ZWG" };
  }
  if (/usd/i.test(sheetName) && rec.amount !== 0) {
    return { ...rec, usdAmount: rec.amount, currency: "USD" };
  }
  return rec;
}

/** NMB statement rows: agent = MPOS code in narration, deposit = credit. */
function nmbStatementRecord(sheetName: string, i: number, row: SourceRow): NormalizedRecord | null {
  const credit = toNumber(cell(row, "CreditAmount", "Credit Amount", "Credit"));
  if (credit === 0) return null; // debit/balance rows aren't deposits
  const narration = String(cell(row, "Narration", "Narrative", "Details") ?? "");
  const code = MPOS_CODE.exec(narration)?.[1]?.toUpperCase();
  const ref = cell(row, "Ref. No.", "Ref", "Reference");
  const rec = makeRecord(
    sheetName, i, row, "deposit", [],
    ["CreditAmount", "Credit Amount"], ["Ref. No.", "Ref", "Reference"]
  );
  return applyConversion(
    {
      ...rec,
      externalId: code,
      bankAccount: /usd/i.test(sheetName) ? "NMB USD" : "NMB",
      narration: narration.trim() || rec.narration,
      reference: String(ref ?? `NMB:${i}`),
      date: toDate(cell(row, "Transaction Date", "Date", "Value Date")) ?? rec.date,
    },
    row, sheetName
  );
}

/** NBS settlement report: agent = TID (terminal id), deposit = TOTAL (USD on USD sheets). */
function nbsStatementRecord(sheetName: string, i: number, row: SourceRow): NormalizedRecord {
  const tid = String(cell(row, "TID", "Terminal ID") ?? "").trim();
  const rec = makeRecord(sheetName, i, row, "deposit", ["TID"], ["TOTAL", "Total"], ["TID"]);
  const merchant = String(cell(row, "MERCHANT NAME", "Merchant Name") ?? "").trim();
  const amount = toNumber(cell(row, "TOTAL", "Total"));
  return applyConversion(
    {
      ...rec,
      externalId: tid || undefined,
      amount,
      bankAccount: /usd/i.test(sheetName) ? "NBS USD" : "NBS",
      narration: merchant || rec.narration,
      reference: `NBS:${tid || i}`,
    },
    row, sheetName
  );
}

/** CBZ POS report: agent = TERMINAL ID (with AGENT NAME as the name fallback). */
function cbzStatementRecord(sheetName: string, i: number, row: SourceRow): NormalizedRecord {
  const terminal = String(cell(row, "TERMINAL ID", "Terminal ID", "TID") ?? "").trim();
  const rec = makeRecord(
    sheetName, i, row, "deposit",
    ["TERMINAL ID", "Terminal ID", "TID", "AGENT NAME", "Agent Name"],
    ["AMOUNT", "Amount"], ["TERMINAL ID", "Ref", "Reference"]
  );
  return {
    ...rec,
    externalId: terminal || rec.externalId,
    bankAccount: "CBZ",
    reference: `CBZ:${terminal || i}`,
  };
}

/**
 * Detect bank-statement sheets by their header shape (names vary: "NMB ZWG",
 * "NBS USD", "CBZ ") and extract deposit records. Returns null for ordinary
 * transaction sheets so the caller falls back to the generic path.
 */
function bankStatementRecords(sheetName: string, rows: SourceRow[]): NormalizedRecord[] | null {
  if (rows.length === 0) return null;
  const sample = rows[0];
  if (hasCols(sample, "Narration") && (hasCols(sample, "CreditAmount") || hasCols(sample, "Credit Amount"))) {
    return rows
      .map((r, i) => nmbStatementRecord(sheetName, i, r))
      .filter((r): r is NormalizedRecord => r !== null)
      .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
  }
  if (hasCols(sample, "TID") && hasCols(sample, "MERCHANT NAME")) {
    return rows
      .map((r, i) => nbsStatementRecord(sheetName, i, r))
      .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
  }
  if (hasCols(sample, "TERMINAL ID") && hasCols(sample, "AGENT NAME")) {
    return rows
      .map((r, i) => cbzStatementRecord(sheetName, i, r))
      .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
  }
  return null;
}

/** Bare code half of "ZW018ZLN - SHOWNE ZULU" style cells (ZINARA users). */
function bareCode(v: string | undefined): { code?: string; name?: string } {
  if (!v) return {};
  const idx = v.indexOf(" - ");
  if (idx <= 0) return { code: v.trim() || undefined };
  return { code: v.slice(0, idx).trim() || undefined, name: v.slice(idx + 3).trim() || undefined };
}

/** ---------------- Enpassent adapter ---------------- */

export const enpassentAdapter: SourceAdapter = {
  module: "enpassent",
  supportsSheet(name) {
    if (ECONET_SHEET.test(name)) return false;
    return /insurance|zinara|deposit|settlement|transfer|ecocash|alteration|adjust|nmb|nbs|cbz|steward|summary|transactions|statement/i.test(
      name
    );
  },
  normalise(sheetName, rows) {
    // Bank statements / POS reports have their own layouts — extract them
    // before the generic column guessing below.
    const bank = bankStatementRecords(sheetName, rows);
    if (bank) return bank;

    const isZinara = /zinara/i.test(sheetName);
    const isDeposit = /deposit|settlement|bank|transfer|ecocash/i.test(sheetName);
    const isInsurance = /insur|summary|transactions/i.test(sheetName);
    const isAdjustment = /alteration|adjust/i.test(sheetName);

    // ZINARA licensing report: the agent is the "User" cell
    // ("ZW018ZLN - SHOWNE ZULU") — "Agent" is the shared merchant name, not an
    // agent. RECON confirms the revenue figure is the gross licensing totals
    // E+F (collections net of cancellations); the Deposit (G)/Payment Amount
    // columns are settlement, counted on the bank sheets.
    if (isZinara) {
      return rows
        .map((row, i) => {
          const rec = makeRecord(
            sheetName, i, row, "zinara",
            ["User", "ZINARA User", "ZINARA Account", "Account ID", "Zinara ID", ...AGENT_ID_KEYS],
            ["__none__"],
            ["Registration Number", "Ref", "Reference", "Receipt No"]
          );
          const { code, name } = bareCode(rec.externalId);
          const amount =
            toNumber(cell(row, "Vehicle Licensing Total (E=A-C)", "Vehicle Licensing Total")) +
            toNumber(cell(row, "Radio / TV Licensing Total (F=B-D)", "Radio / TV Licensing Total"));
          return {
            ...rec,
            amount,
            externalId: code ?? rec.externalId,
            agentNameHint: name ?? rec.agentNameHint,
            zinaraAccountId: code ?? rec.zinaraAccountId,
          };
        })
        .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
    }

    if (isDeposit) {
      return rows
        .map((row, i) =>
          applyConversion(
            makeRecord(
              sheetName, i, row, "deposit",
              [...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS],
              ["Amount", "Deposit", "Settled", "Settled Amount", "Value", "Deposited"],
              ["Ref", "Reference", "Receipt No", "Ecocash Reference", "Narration /Ref"]
            ),
            row, sheetName
          )
        )
        .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
    }

    const category: NormalizedRecord["category"] = isInsurance ? "insurance" : "adjustment";
    const amountKeys = isInsurance
      ? ["Premium_Collected", "Premium Collected", "Premium", "Premium Amount", "Amount", "Value", "Total"]
      : ["Amount", "Premium", "Premium Collected", "Premium Amount", "Value", "Total"];

    return rows
      .filter((row) => !(isInsurance && /^cancelled$/i.test(String(cell(row, "Status") ?? "").trim())))
      .map((row, i) => {
        const rec = makeRecord(sheetName, i, row, category, [...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS], amountKeys, [
          "Policy No",
          "Policy_No",
          "Ref",
          "Reference",
          "Receipt No",
          "Narration /Ref",
        ]);
        // Enpassent commission is 10% of policy cover when the sheet doesn't
        // carry an explicit Commission column (validated against RECON).
        const cover = toNumber(cell(row, "Policy Cover", "Policy_Cover", "Cover"));
        const commission = rec.commission ?? (isInsurance && cover ? cover * 0.1 : undefined);
        // The workbook's Variance = Expected − Deposits − Alterations, so
        // alteration amounts enter the engine as negatives.
        const amount = isAdjustment ? -rec.amount : rec.amount;
        return { ...rec, amount, commission };
      })
      .filter((r) => r.amount !== 0 || r.externalId || r.usdAmount);
  },
};

/** ---------------- Econet Moovah adapter ---------------- */

export const econetMoovahAdapter: SourceAdapter = {
  module: "econet-moovah",
  supportsSheet(name) {
    if (ENPASSENT_SHEET.test(name)) return false;
    return /insurance|zinara|deposit|settlement|transfer|ecocash|pos|float|alteration|adjust|nmb|nbs|cbz|steward|statement/i.test(
      name
    );
  },
  normalise(sheetName, rows) {
    const bank = bankStatementRecords(sheetName, rows);
    if (bank) return bank;

    const isDeposit = /deposit|pos|float|transfer|ecocash|bank/i.test(sheetName);
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
      .map((row, i) => {
        const rec = makeRecord(
          sheetName,
          i,
          row,
          category,
          ["Econet ID", "EcoCash ID", "MSISDN", ...AGENT_ID_KEYS, ...NAME_FALLBACK_KEYS],
          ["Amount", "Premium Collected", "Premium", "Premium Amount", "Float", "Value", "Total"],
          ["Ref", "Reference", "Txn Ref", "Transaction Ref"]
        );
        return category === "deposit" ? applyConversion(rec, row, sheetName) : rec;
      })
      .filter((r) => r.amount !== 0 || r.externalId);
  },
};

export const ADAPTERS: SourceAdapter[] = [enpassentAdapter, econetMoovahAdapter];

export function adapterFor(module: string): SourceAdapter {
  return ADAPTERS.find((a) => a.module === module) ?? enpassentAdapter;
}
