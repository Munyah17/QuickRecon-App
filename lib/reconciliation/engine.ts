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
  const refSeen = new Map<string, NormalizedRecord>();
  let duplicates = 0;
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
        description: `Reference ${rec.reference} appears twice (${CATEGORY_LABEL[rec.category]}).`,
      });
    }
    refSeen.set(k, rec);
  }

  // 4. Aggregate per agent; currency mixing is flagged, never silently merged.
  const byAgent = new Map<string, NormalizedRecord[]>();
  for (const rec of matched) {
    byAgent.set(rec.agentId, [...(byAgent.get(rec.agentId) ?? []), rec]);
  }

  const results: AgentReconResult[] = [];
  for (const [agentId, recs] of byAgent) {
    const agent = agentIndex.get(agentId);
    if (!agent) continue;

    const currencies = new Set(recs.map((r) => r.currency));
    const currency: Currency = currencies.size > 1 ? "ZWG" : (recs[0]?.currency ?? "ZWG");
    if (currencies.size > 1) {
      exceptions.push({
        type: "invalid_currency",
        severity: "high",
        module: input.module,
        agentId,
        sourceRef: "batch",
        description: `Mixed currencies detected for ${agent.fullName}; explicit conversion rule required.`,
      });
    }

    const sum = (cat: NormalizedRecord["category"]) =>
      recs.filter((r) => r.category === cat && r.currency === currency).reduce((n, r) => n + r.amount, 0);

    const insurance = sum("insurance");
    const zinara = sum("zinara");
    const deposits = sum("deposit");
    const adjustments = sum("adjustment");
    const opening = agent.openingPosition ?? 0;
    const closing = opening + insurance + zinara + adjustments - deposits;

    const lines = (["insurance", "zinara", "deposit", "adjustment"] as const).map((cat) => {
      const actual = sum(cat);
      return {
        item: CATEGORY_LABEL[cat],
        category: cat,
        expected: actual,
        actual,
        variance: 0,
      };
    });

    const status: AgentReconResult["status"] =
      Math.abs(closing) > 100_000 ? "attention" : Math.abs(closing) > 0 ? "warning" : "success";

    results.push({
      agentId,
      agentName: agent.fullName,
      currency,
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
      recordsNormalised: matched.length,
      unmatched,
      duplicates,
    },
  };
}
