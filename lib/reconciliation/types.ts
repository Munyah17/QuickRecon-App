import type { Currency, ModuleCode, ReconExceptionType } from "@/types";

/** Raw sheet row as parsed by the workbook reader (keys = header names). */
export type SourceRow = Record<string, unknown>;

/** Canonical transaction after an adapter has understood a source row. */
export interface NormalizedRecord {
  /** Strong identity when present (e.g. EP-99117, IceCash ID). */
  externalId?: string;
  /** Weaker identity hint, never trusted on its own. */
  agentNameHint?: string;
  agentId?: string;
  category: "insurance" | "zinara" | "deposit" | "adjustment";
  amount: number;
  currency: Currency;
  reference: string;
  date?: string;
  sourceSheet: string;
  sourceRow: number;
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

export interface AgentReconResult {
  agentId: string;
  agentName: string;
  currency: Currency;
  openingPosition: number;
  insurance: number;
  zinara: number;
  deposits: number;
  adjustments: number;
  closingPosition: number;
  status: "success" | "warning" | "attention";
  recordCount: number;
  /** Line-level expected vs actual for the detail view. */
  lines: {
    item: string;
    category: NormalizedRecord["category"];
    expected: number;
    actual: number;
    variance: number;
  }[];
}

export interface EngineOutput {
  module: ModuleCode;
  period: string;
  results: AgentReconResult[];
  exceptions: EngineException[];
  stats: {
    recordsIn: number;
    recordsNormalised: number;
    unmatched: number;
    duplicates: number;
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
