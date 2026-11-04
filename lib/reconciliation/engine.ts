import { adapterFor, sheetLooksLikeAgentData } from "./adapters";
import { IdentityResolver } from "./identity-resolver";
import type {
  AgentReconResult,
  EngineException,
  EngineOutput,
  IdentityAlias,
  NormalizedRecord,
  SourceRow,
  TransactionDetail,
} from "./types";
import type { Currency, ModuleCode } from "@/types";

/** Normalise bank/account names to canonical channel names.
 *  USD channels are checked per bank before the generic USD catch-all so
 *  "CBZ USD" doesn't collapse into "CBZ" or "USD Deposits". */
export function normalizeBankName(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper.includes("ECOCASH")) return "Ecocash";
  if (upper.includes("STEWARD")) return "STEWARD";
  if (upper.includes("TRANSFER")) return "Transfers";
  // Per-bank USD buckets must resolve before the plain-bank and generic-USD
  // checks — "NMB USD" is its own channel, not "NMB" and not "USD Deposits".
  if (upper.includes("NBS") || upper.includes("BANC ABC") || upper.includes("BANCABC")) {
    return upper.includes("USD") || upper.includes("US$") ? "NBS USD" : "NBS";
  }
  if (upper.includes("CBZ")) return upper.includes("USD") || upper.includes("US$") ? "CBZ USD" : "CBZ";
  if (upper.includes("NMB")) return upper.includes("USD") || upper.includes("US$") ? "NMB USD" : "NMB";
  if (upper.includes("USD") || upper.includes("US$")) return "USD Deposits";
  // Unrecognised channels aren't banks at all — the engine excludes them
  // from the bank breakdown (and reports them) rather than spawning a
  // mystery column for every raw string a sheet happens to contain.
  return "Other";
}

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

  // 1. Normalise all selected sheets. Sheets the adapter doesn't recognise
  // are skipped and reported — feeding them through would fabricate
  // "adjustment" records from unrelated columns.
  const normalised: NormalizedRecord[] = [];
  const skippedSheets: string[] = [];
  const inferredSheets: string[] = [];
  for (const [sheetName, rows] of Object.entries(input.sheets)) {
    if (adapter.supportsSheet(sheetName)) {
      const recs = adapter.normalise(sheetName, rows);
      // A recognised sheet that yields nothing used to vanish silently —
      // that's how whole categories go missing. Surface it for review.
      if (rows.length && recs.length === 0) {
        exceptions.push({
          type: "missing_column",
          severity: "medium",
          module: input.module,
          sourceRef: sheetName,
          description: `Worksheet "${sheetName}" is a recognised layout but no rows could be read — check its header/columns.`,
        });
      }
      normalised.push(...recs);
      continue;
    }
    // The workbook may carry agent worksheets the adapter doesn't know by
    // name — capture them when the rows carry agent + amount columns, and
    // report each so the inferred category can be verified. Anything else
    // is skipped and recorded as such rather than silently dropped.
    if (rows.length && sheetLooksLikeAgentData(sheetName, rows)) {
      normalised.push(...adapter.normalise(sheetName, rows));
      inferredSheets.push(sheetName);
      exceptions.push({
        type: "schema_changed",
        severity: "low",
        module: input.module,
        sourceRef: sheetName,
        description: `Worksheet "${sheetName}" isn't a recognised layout — rows were captured by column detection. Verify the inferred category.`,
      });
      continue;
    }
    skippedSheets.push(sheetName);
  }

  // 2. Identity resolution.
  const resolver = new IdentityResolver(input.aliases);
  const agentNameIndex = new Map(input.agents.map((a) => [a.fullName.toUpperCase(), a.id]));
  // Token index for fuzzy names — the dump writes "ZHOU, Musa",
  // "Musa  Zhou" or "Zhou Musa" and exact matching drops those rows,
  // which is how an agent ends up with deposits but zero insurance.
  const tokensOf = (s: string) => new Set(s.toUpperCase().split(/[^A-Z]+/).filter((t) => t.length > 1));
  const agentTokenSets = input.agents.map((a) => ({ id: a.id, tokens: tokensOf(a.fullName) }));
  const nameByTokens = (hint: string): string | undefined => {
    const hintTokens = tokensOf(hint.replace(/,/g, " "));
    if (hintTokens.size < 2) return undefined;
    const hits = agentTokenSets.filter((a) => a.tokens.size > 0 && [...hintTokens].every((t) => a.tokens.has(t)));
    return hits.length === 1 ? hits[0].id : undefined;
  };

  const matched: (NormalizedRecord & { agentId: string })[] = [];
  const learned = new Map<string, { agentId: string; value: string }>();
  let unmatched = 0;

  for (const rec of normalised) {
    const match = resolver.resolve(rec);
    let agentId = match.agentId;

    // Name matches only proceed when unambiguous — exact-cased full name
    // first, then a token-subset fallback for reordered/punctuated names.
    if (!agentId && match.confidence === "name" && rec.agentNameHint) {
      const hit = agentNameIndex.get(rec.agentNameHint.toUpperCase())
        ?? agentNameIndex.get(rec.agentNameHint.replace(/\s+/g, " ").trim().toUpperCase())
        ?? nameByTokens(rec.agentNameHint);
      if (hit) {
        agentId = hit;
        // The row's company code now provably belongs to this agent — learn
        // it so remaining rows with the code (but no matching name) resolve
        // here, and the caller persists it for future batches.
        if (rec.externalId) {
          resolver.learn(rec.externalId, hit);
          learned.set(`${hit}|${IdentityResolver.key(rec.externalId)}`, {
            agentId: hit,
            value: rec.externalId,
          });
        }
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
      return amount;
    };

    const sum = (cat: NormalizedRecord["category"]) =>
      recs
        .filter((r) => r.category === cat)
        .reduce((n, r) => n + convert(r.amount, r.currency), 0);

    const insuranceRecs = recs.filter((r) => r.category === "insurance");
    const depositRecs = recs.filter((r) => r.category === "deposit");

    const insurance = sum("insurance");
    const zinara = sum("zinara");
    const adjustments = sum("adjustment");
    const pds = 0; // Placeholder: Pds category not yet in source data

    // Commission and net insurance (Enpassent-specific).
    const commission = insuranceRecs.reduce(
      (n, r) => n + convert(r.commission ?? 0, r.currency),
      0
    );
    const netInsurance = insurance - commission;
    const premiumCover = netInsurance; // Premium cover = net insurance in Enpassent.

    // Per-bank deposit breakdown. Unrecognised channels stay OUT of
    // bankDeposits (they'd surface as mystery "banks" in every report),
    // but their amounts still count toward deposits and each one is
    // reported so a real bank name can be added to the mapping.
    const bankDeposits: Record<string, number> = {};
    const unrecognisedBanks = new Map<string, number>();
    for (const r of depositRecs) {
      const bank = normalizeBankName(r.bankAccount ?? "");
      r.bankChannel = bank;
      const amount = convert(r.amount, r.currency);
      if (bank === "Other") {
        const key = `${r.sourceSheet}|${(r.bankAccount ?? "").trim() || "(no channel column)"}`;
        unrecognisedBanks.set(key, (unrecognisedBanks.get(key) ?? 0) + amount);
      } else {
        bankDeposits[bank] = (bankDeposits[bank] ?? 0) + amount;
      }
    }
    for (const [key, total] of unrecognisedBanks) {
      const [sheet, name] = key.split("|");
      exceptions.push({
        type: "unrecognised_payment_source",
        severity: "medium",
        module: input.module,
        agentId,
        sourceRef: sheet,
        description: `Deposit channel "${name}" isn't a known bank — ${total.toLocaleString()} counted in deposits but given no bank column.`,
      });
    }
    const deposits = depositRecs.reduce((n, r) => n + convert(r.amount, r.currency), 0);

    // Opening variance = carry-forward from previous period (openingPosition).
    const openingVariance = agent.openingPosition ?? 0;

    // Total Expected = Net Insurance + Zinara + Pds + Opening Variance
    const totalExpected = netInsurance + zinara + pds + openingVariance;

    // Closing Variance = Total Expected - Total Deposits + Alterations
    const closingVariance = totalExpected - deposits + adjustments;
    const closing = closingVariance;

    // Transaction-level detail rows across every category — the workbook's
    // Insurance / ZINARA / Alterations sheets read these, so deposits alone
    // would leave them permanently empty.
    const transactions: TransactionDetail[] = recs.map((r) => ({
      date: r.date,
      agentName: agent.fullName,
      amount: convert(r.amount, r.currency),
      currency: r.currency,
      usdAmount: r.usdAmount,
      usdConversionRate: r.usdConversionRate,
      bankAccount: r.bankAccount,
      bankChannel: r.bankChannel,
      narration: r.narration,
      reference: r.reference,
      category: r.category,
      vrn: r.vrn,
      insuranceCompany: r.insuranceCompany,
      rtaAmount: r.rtaAmount,
      zinaraAccountId: r.zinaraAccountId,
      paymentMethod: r.paymentMethod,
    }));

    // Build meaningful line items.
    const lines = (
      [
        { cat: "insurance" as const, label: "Insurance" },
        { cat: "zinara" as const, label: "ZINARA" },
        { cat: "deposit" as const, label: "Deposits" },
        { cat: "adjustment" as const, label: "Adjustments" },
      ]
    ).map(({ cat, label }) => {
      const actual = cat === "deposit" ? deposits : sum(cat);
      const lineExpected = cat === "deposit" ? totalExpected : actual;
      const lineVariance = cat === "deposit" ? totalExpected - deposits : 0;
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
      openingPosition: openingVariance,
      openingVariance,
      insurance,
      premiumCover,
      commission,
      netInsurance,
      zinara,
      pds,
      totalExpected,
      bankDeposits,
      deposits,
      adjustments,
      closingPosition: closing,
      closingVariance,
      status,
      recordCount: recs.length,
      transactions,
      lines,
    });
  }

  return {
    module: input.module,
    period: input.period,
    results,
    exceptions,
    learnedAliases: [...learned.values()],
    stats: {
      recordsIn: normalised.length,
      recordsNormalised: deduped.length,
      unmatched,
      duplicates,
      skippedSheets,
      inferredSheets,
    },
  };
}
