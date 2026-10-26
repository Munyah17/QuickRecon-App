import type { AgentReconResult } from "@/lib/reconciliation/types";
import type { ModuleCode } from "@/types";

export interface RiskFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface RiskScore {
  agentId: string;
  module: ModuleCode;
  period: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
}

/** Prior-period outcome for one agent, newest first. */
export interface AgentHistoryRow {
  closing_position: number | null;
  status: string | null;
  deposits: number | null;
  insurance: number | null;
}

function levelFor(score: number): RiskScore["level"] {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Weighted, fully explainable agent risk score.
 *
 *   status signal        0–30   (current batch outcome)
 *   deposit shortfall    0–35   (share of expected not banked)
 *   closing gap size     0–15   (variance relative to expected)
 *   repeat offender      0–15   (prior periods with nonzero closings)
 *   open exceptions      0–15   (unresolved issues already logged)
 *   dormant agent        +10    (in scope but zero source records)
 *
 * Total is capped at 100. Every point is attributed in `factors` so the
 * score can be defended in an audit.
 */
export function computeRiskScore(
  result: AgentReconResult,
  history: AgentHistoryRow[],
  openExceptionCount: number,
  module: ModuleCode,
  period: string
): RiskScore {
  const factors: RiskFactor[] = [];
  const add = (factor: string, weight: number, detail: string) => {
    if (weight <= 0) return;
    factors.push({ factor, weight, detail });
  };

  // 1. Batch status
  add(
    "batch_status",
    result.status === "attention" ? 30 : result.status === "warning" ? 15 : 0,
    `current reconciliation status is '${result.status}'`
  );

  // 2. Deposit shortfall ratio
  const expected = Math.abs(result.totalExpected);
  if (expected > 0) {
    const shortfallRatio = Math.max(0, 1 - result.deposits / expected);
    add(
      "deposit_shortfall",
      Math.min(35, shortfallRatio * 35),
      `banked ${result.deposits.toLocaleString()} of ${expected.toLocaleString()} expected (${Math.round(shortfallRatio * 100)}% short)`
    );
  }

  // 3. Closing gap relative to expected
  const closingRatio = expected > 0 ? Math.abs(result.closingVariance) / expected : 0;
  if (closingRatio > 0.15) {
    add(
      "closing_gap",
      15,
      `closing variance ${Math.round(closingRatio * 100)}% of expected (threshold 15%)`
    );
  }

  // 4. Repeat offender — prior periods also ended with a nonzero closing
  const repeatCount = history.filter(
    (h) => Math.abs(Number(h.closing_position) || 0) > 1
  ).length;
  add(
    "repeat_closings",
    Math.min(15, repeatCount * 5),
    `${repeatCount} prior period${repeatCount === 1 ? "" : "s"} closed with a nonzero position`
  );

  // 5. Already-open exceptions against this agent
  add(
    "open_exceptions",
    Math.min(15, openExceptionCount * 3),
    `${openExceptionCount} open exception${openExceptionCount === 1 ? "" : "s"} on record`
  );

  // 6. No activity at all in this batch
  add(
    "no_activity",
    result.recordCount === 0 ? 10 : 0,
    "agent was in scope but produced zero source records"
  );

  const score = clamp100(factors.reduce((n, f) => n + f.weight, 0));
  return { agentId: result.agentId, module, period, score, level: levelFor(score), factors };
}

export function computeBatchRiskScores(
  results: AgentReconResult[],
  historyByAgent: Map<string, AgentHistoryRow[]>,
  openExceptionsByAgent: Map<string, number>,
  module: ModuleCode,
  period: string
): RiskScore[] {
  return results.map((r) =>
    computeRiskScore(r, historyByAgent.get(r.agentId) ?? [], openExceptionsByAgent.get(r.agentId) ?? 0, module, period)
  );
}
