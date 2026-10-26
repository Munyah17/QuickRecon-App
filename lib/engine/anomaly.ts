import type { AgentReconResult } from "@/lib/reconciliation/types";
import type { ModuleCode } from "@/types";

export interface ImportAnomaly {
  kind:
    | "volume_outlier"
    | "deposit_ratio_low"
    | "zero_deposit_high_revenue"
    | "round_numbers"
    | "missing_agent";
  severity: "critical" | "high" | "medium" | "low";
  agentId?: string;
  agentName?: string;
  details: Record<string, unknown>;
  description: string;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / xs.length);
}

/**
 * Statistical anomaly detection across a processed batch. Complements the
 * rule engine: it catches things that are *unusual* rather than *invalid* —
 * extreme volumes, agents banking far below their revenue, dormant agents,
 * and suspiciously round figures (a classic manual-entry tell).
 */
export function detectAnomalies(
  results: AgentReconResult[],
  module: ModuleCode
): ImportAnomaly[] {
  const anomalies: ImportAnomaly[] = [];

  // --- 1. Volume outliers (peer-group z-score on expected totals) ----------
  const active = results.filter((r) => r.recordCount > 0);
  if (active.length >= 10) {
    const xs = active.map((r) => Math.abs(r.totalExpected));
    const m = mean(xs);
    const sd = stddev(xs);
    if (sd > 0) {
      for (const r of active) {
        const z = Math.abs(r.totalExpected - m) / sd;
        if (z >= 3) {
          anomalies.push({
            kind: "volume_outlier",
            severity: z >= 5 ? "high" : "medium",
            agentId: r.agentId,
            agentName: r.agentName,
            details: { zScore: Number(z.toFixed(2)), expected: r.totalExpected, peerMean: Math.round(m) },
            description: `${r.agentName}'s expected total is ${z.toFixed(1)}σ from the batch mean — well outside peer range.`,
          });
        }
      }
    }
  }

  for (const r of results) {
    const expected = Math.abs(r.totalExpected);

    // --- 2. Dormant agent -------------------------------------------------
    if (r.recordCount === 0) {
      anomalies.push({
        kind: "missing_agent",
        severity: "low",
        agentId: r.agentId,
        agentName: r.agentName,
        details: {},
        description: `${r.agentName} has no records in this import — verify they submitted.`,
      });
      continue;
    }

    // --- 3. Zero deposits against real revenue ----------------------------
    if (r.deposits === 0 && expected > 0) {
      anomalies.push({
        kind: "zero_deposit_high_revenue",
        severity: "high",
        agentId: r.agentId,
        agentName: r.agentName,
        details: { totalExpected: r.totalExpected },
        description: `${r.agentName} banked nothing against ${expected.toLocaleString()} expected.`,
      });
      continue; // ratio check below is implied by this one
    }

    // --- 4. Deposit coverage ratio ---------------------------------------
    const ratio = expected > 0 ? r.deposits / expected : 1;
    if (expected > 0 && ratio < 0.85) {
      anomalies.push({
        kind: "deposit_ratio_low",
        severity: ratio < 0.5 ? "high" : "medium",
        agentId: r.agentId,
        agentName: r.agentName,
        details: { ratio: Number(ratio.toFixed(3)), deposits: r.deposits, expected: r.totalExpected },
        description: `${r.agentName} banked only ${Math.round(ratio * 100)}% of expected.`,
      });
    }

    // --- 5. Round-number clustering ---------------------------------------
    const txns = r.transactions ?? [];
    if (txns.length >= 10) {
      const round = txns.filter((t) => t.amount % 100 === 0).length;
      const share = round / txns.length;
      if (share >= 0.6) {
        anomalies.push({
          kind: "round_numbers",
          severity: "medium",
          agentId: r.agentId,
          agentName: r.agentName,
          details: { roundShare: Number(share.toFixed(2)), roundCount: round, txnCount: txns.length },
          description: `${Math.round(share * 100)}% of ${r.agentName}'s ${txns.length} entries are round numbers — check for manual figures.`,
        });
      }
    }
  }

  return anomalies;
}
