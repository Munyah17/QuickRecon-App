import type { Currency, ModuleCode, ReconExceptionType } from "@/types";

/** Raw sheet row as parsed by the workbook reader (keys = header names). */
export type SourceRow = Record<string, unknown>;

/** Canonical transaction after an adapter has understood a source row. */
export interface NormalizedRecord {
  externalId?: string;
  agentNameHint?: string;
  agentId?: string;
  category: "insurance" | "zinara" | "deposit" | "adjustment";
  amount: number;
  currency: Currency;
  reference: string;
  date?: string;
  sourceSheet: string;
  sourceRow: number;
  /** Commission deducted from insurance (Enpassent field). */
  commission?: number;
  /** Bank/account channel for deposits (e.g. NBS, CBZ, Ecocash, NMB). */
  bankAccount?: string;
  /** Canonical deposit channel (BANK_CHANNELS) — set by the engine during
   *  bucketing; bankAccount keeps the raw sheet value for display. */
  bankChannel?: string;
  /** USD amount for dual-currency deposit rows. */
  usdAmount?: number;
  /** Conversion rate applied (USD -> ZWG). */
  usdConversionRate?: number;
  /** Narration / reference text from the source. */
  narration?: string;
  /** Vehicle registration / plate (insurance & ZINARA sales). */
  vrn?: string;
  /** Insurer name for insurance sales. */
  insuranceCompany?: string;
  /** RTA amount for insurance sales. */
  rtaAmount?: number;
  /** ZINARA account identifier. */
  zinaraAccountId?: string;
  /** Payment method for ZINARA sales. */
  paymentMethod?: string;
}

/** Mapping table used by the identity resolver (agent_external_ids). */
export interface IdentityAlias {
  scheme: string;
  value: string;
  agentId: string;
}

export interface IdentityMatch {
  record: NormalizedRecord;
  agentId?: string;
  confidence: "exact" | "alias" | "name" | "none";
}

export interface EngineException {
  type: ReconExceptionType | "unmatched_agent";
  severity: "critical" | "high" | "medium" | "low";
  module: ModuleCode;
  agentId?: string;
  sourceRef: string;
  description: string;
}

/** Known bank / deposit channels from the real Enpassent workflow.
 *  USD money is bucketed per bank (CBZ USD / NMB USD / NBS USD) when the
 *  statement names one, else under the generic "USD Deposits" channel. */
export const BANK_CHANNELS = [
  "Ecocash",
  "CBZ",
  "CBZ USD",
  "NBS",
  "NBS USD",
  "STEWARD",
  "NMB",
  "NMB USD",
  "FBC",
  "USD Deposits",
  "Transfers",
] as const;
export type BankChannel = (typeof BANK_CHANNELS)[number];

export interface TransactionDetail {
  date?: string;
  agentName: string;
  amount: number;
  currency?: Currency;
  usdAmount?: number;
  usdConversionRate?: number;
  bankAccount?: string;
  /** Canonical deposit channel — used for per-bank workbook sheets. Older
   *  persisted docs lack it; fall back to bankAccount via normalizeBankName. */
  bankChannel?: string;
  narration?: string;
  reference: string;
  /** Bucket used by workbook sheets: insurance | zinara | deposit | adjustment. */
  category?: "insurance" | "zinara" | "deposit" | "adjustment";
  /** Vehicle registration / plate (Insurance & ZINARA sheets). */
  vrn?: string;
  /** Insurer name (Insurance & bank sheets). */
  insuranceCompany?: string;
  /** RTA amount for insurance sales. */
  rtaAmount?: number;
  /** ZINARA account identifier (ZINARA sheet). */
  zinaraAccountId?: string;
  /** Payment method for ZINARA sales. */
  paymentMethod?: string;
}

export interface AgentReconResult {
  agentId: string;
  agentName: string;
  currency: Currency;
  openingPosition: number;
  openingVariance: number;
  insurance: number;
  premiumCover: number;
  commission: number;
  netInsurance: number;
  zinara: number;
  pds: number;
  totalExpected: number;
  /** Per-bank deposit breakdown. */
  bankDeposits: Record<string, number>;
  deposits: number;
  adjustments: number;
  closingPosition: number;
  closingVariance: number;
  status: "success" | "warning" | "attention";
  recordCount: number;
  /** Transaction-level deposit detail rows. */
  transactions: TransactionDetail[];
  /** Line-level expected vs actual for the detail view. */
  lines: {
    item: string;
    category: NormalizedRecord["category"];
    expected: number;
    actual: number;
    variance: number;
  }[];
}

export interface SheetAudit {
  sheet: string;
  /** mapped — recognised layout; inferred — captured by column shape;
   *  skipped — not transaction data; empty — recognised but yielded nothing. */
  action: "mapped" | "inferred" | "skipped" | "empty";
  rowsIn: number;
  records: number;
  /** Dominant record category produced (when any). */
  category?: string;
}

export interface EngineOutput {
  module: ModuleCode;
  period: string;
  results: AgentReconResult[];
  exceptions: EngineException[];
  /**
   * External codes resolved to an agent by name this run — the caller
   * persists these to agent_external_ids under the module's company scheme
   * so future batches match by alias.
   */
  learnedAliases: { agentId: string; value: string }[];
  stats: {
    recordsIn: number;
    recordsNormalised: number;
    unmatched: number;
    duplicates: number;
    /** Sheets skipped because the adapter doesn't recognise their format. */
    skippedSheets: string[];
    /** Data-bearing sheets captured by column shape rather than a
     *  recognised worksheet name — the engine reported each as an
     *  exception so the operator can verify the inferred category. */
    inferredSheets: string[];
    /** Per-worksheet mapping decision — the audit trail for what the
     *  engine did with every sheet it was handed. */
    sheets: SheetAudit[];
  };
}

/** Per-module source adapter contract. */
export interface SourceAdapter {
  module: ModuleCode;
  /** Decide whether a worksheet belongs to this module's source format. */
  supportsSheet(sheetName: string): boolean;
  /** Convert raw rows into canonical records. */
  normalise(sheetName: string, rows: SourceRow[]): NormalizedRecord[];
}
