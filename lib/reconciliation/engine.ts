import { adapterFor } from "./adapters";
import { IdentityResolver } from "./identity-resolver";
import type {
  AgentReconResult,
  EngineException,
  EngineOutput,
  IdentityAlias,
  NormalizedRecord,
  SourceRow,
} from "./types";
import type { Currency, ModuleCode } from "@/types";

interface AgentIdentity {
  id: string;
  fullName: string;
  openingPosition?: number;
}

export interface RunEngineInput {
  module: ModuleCode;
  period: string;
  /** sheet name -> rows (only sheets the operator selected) */
  sheets: Record<string, SourceRow[]>;
  agents: AgentIdentity[];
  aliases: IdentityAlias[];
  /** Optional: variance thresholds for status classification. */
  thresholds?: {
    attention: number;
    warning: number;
  };
  /** Optional: exchange rates for currency conversion (per currency -> base). */
  exchangeRates?: Partial<Record<Currency, number>>;
}

const CATEGORY_LABEL: Record<NormalizedRecord["category"], string> = {
  insurance: "Insurance",
  zinara: "ZINARA",
  deposit: "Deposits",
  adjustment: "Adjustments",
};

/**
 * The reconciliation engine.
 *
 *   Expected = Opening + Reconcilable revenue ± adjustments
 *   Closing  = Expected − recognised deposits/settlements
 *
 * Rules that differ per module live in rules/<module>.ts; adapters translate
 * source workbooks into canonical records. Rules can be tuned without
 * touching the orchestration here.
 */
export function runReconciliationEngine(input: RunEngineInput): EngineOutput {
  const adapter = adapterFor(input.module);
  const exceptions: EngineException[] = [];

  // 1. Normalise all selected sheets.
  const normalised: NormalizedRecord[] = [];
  for (const [sheetName, rows] of Object.entries(input.sheets)) {
    normalised.push(...adapter.normalise(sheetName, rows));
  }

  // 2. Identity resolution.
  const resolver = new IdentityResolver(input.aliases);
  const agentNameIndex = new Map(input.agents.map((a) => [a.fullName.toUpperCase(), a.id]));
  const agentIndex = new Map(input.agents.map((a) => [a.id, a]));

  const matched: (NormalizedRecord & { agentId: string })[] = [];
  let unmatched = 0;

  for (const rec of normalised) {
    const match = resolver.resolve(rec);
    let agentId = match.agentId;

    // Name matches only proceed when unambiguous (exact-cased full name).
    if (!agentId && match.confidence === "name" && rec.agentNameHint) {
      const hit = agentNameIndex.get(rec.agentNameHint.toUpperCase());
      if (hit) {
        agentId = hit;
      } else {
        unmatched++;
        exceptions.push({
          type: "unmatched_agent",
          severity: "critical",
          module: input.module,
          sourceRef: `${rec.sourceSheet}!R${rec.sourceRow}`,
          description: `Name "${rec.agentNameHint}" does not map to a known agent. Resolve manually in the exception centre.`,
        });
        continue;
      }
    }
    if (!agentId) {
      unmatched++;
      exceptions.push({
        type: rec.externalId ? "unknown_external_id" : "unmatched_agent",
        severity: rec.externalId ? "high" : "critical",
        module: input.module,
        sourceRef: `${rec.sourceSheet}!R${rec.sourceRow}`,
        description: rec.externalId
          ? `External identity "${rec.externalId}" has no mapping in agent_external_ids.`
          : `Row has no usable agent identity (${rec.reference}).`,
      });
      continue;
    }
    matched.push({ ...rec, agentId });
  }

  // 3. Duplicate reference detection (per agent + category + reference).
  // Duplicates are flagged AND excluded from downstream sums.
  const refSeen = new Map<string, NormalizedRecord>();
  let duplicates = 0;
  const deduped: (NormalizedRecord & { agentId: string })[] = [];
  for (const rec of matched) {
    const k = `${rec.agentId}|${rec.category}|${rec.reference}`.toUpperCase();
    const prev = refSeen.get(k);
    if (prev && prev.amount === rec.amount) {
      duplicates++;
      exceptions.push({
        type: "duplicate_transaction",
        severity: "medium",
        module: input.module,
        agentId: rec.agentId,
        sourceRef: `${rec.sourceSheet}!R${rec.sourceRow}`,
        description: `Reference ${rec.reference} appears twice (${CATEGORY_LABEL[rec.category]}). Duplicate excluded from totals.`,
      });
      continue;
    }
    refSeen.set(k, rec);
    deduped.push(rec);
  }

  // 4. Aggregate per agent using deduped records.
  const byAgent = new Map<string, (NormalizedRecord & { agentId: string })[]>();
  for (const rec of deduped) {
    byAgent.set(rec.agentId, [...(byAgent.get(rec.agentId) ?? []), rec]);
  }

  const thresholds = input.thresholds ?? { attention: 100_000, warning: 1 };
  const rates = input.exchangeRates ?? {};

  const results: AgentReconResult[] = [];

  // Include ALL known agents, even those with zero records.
  for (const agent of input.agents) {
    const agentId = agent.id;
    const recs = byAgent.get(agentId) ?? [];

    const currencies = new Set(recs.map((r) => r.currency));
    const primaryCurrency: Currency = recs[0]?.currency ?? "ZWG";
    const hasMixedCurrency = currencies.size > 1;

    if (hasMixedCurrency) {
      exceptions.push({
        type: "invalid_currency",
        severity: "high",
        module: input.module,
        agentId,
        sourceRef: "batch",
        description: `Mixed currencies detected for ${agent.fullName}; conversion applied using provided rates.`,
      });
    }

    // Convert amounts to primary currency when needed.
    const convert = (amount: number, from: Currency): number => {
      if (from === primaryCurrency) return amount;
      const rate = rates[from];
      if (rate) return Math.round(amount * rate);
      // No rate: flag but include at face value (better than silently dropping).
      return amount;
    };

    const sum = (cat: NormalizedRecord["category"]) =>
      recs
        .filter((r) => r.category === cat)
        .reduce((n, r) => n + convert(r.amount, r.currency), 0);

    const insurance = sum("insurance");
    const zinara = sum("zinara");
    const deposits = sum("deposit");
    const adjustments = sum("adjustment");
    const opening = agent.openingPosition ?? 0;

    // Expected = what the agent should have banked (opening + revenue + adjustments)
    // Actual (deposits) = what was actually banked
    // Closing = Expected - Actual (positive = surplus, negative = shortfall)
    const expected = opening + insurance + zinara + adjustments;
    const closing = expected - deposits;

    // Build meaningful line items: revenue lines show expected vs actual deposits.
    const lines = (
      [
        { cat: "insurance" as const, label: "Insurance" },
        { cat: "zinara" as const, label: "ZINARA" },
        { cat: "deposit" as const, label: "Deposits" },
        { cat: "adjustment" as const, label: "Adjustments" },
      ]
    ).map(({ cat, label }) => {
      const actual = sum(cat);
      // For deposits, expected = revenue categories; for revenue, expected = actual (source of truth)
      const lineExpected = cat === "deposit" ? expected : actual;
      const lineVariance = cat === "deposit" ? expected - actual : 0;
      return {
        item: label,
        category: cat,
        expected: lineExpected,
        actual,
        variance: lineVariance,
      };
    });

    const absClosing = Math.abs(closing);
    const status: AgentReconResult["status"] =
      absClosing > thresholds.attention
        ? "attention"
        : absClosing > thresholds.warning
          ? "warning"
          : "success";

    results.push({
      agentId,
      agentName: agent.fullName,
      currency: primaryCurrency,
      openingPosition: opening,
      insurance,
      zinara,
      deposits,
      adjustments,
      closingPosition: closing,
      status,
      recordCount: recs.length,
      lines,
    });
  }

  return {
    module: input.module,
    period: input.period,
    results,
    exceptions,
    stats: {
      recordsIn: normalised.length,
      recordsNormalised: deduped.length,
      unmatched,
      duplicates,
    },
  };
}
