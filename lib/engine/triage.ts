import type { EngineException } from "@/lib/reconciliation/types";
import type { RoleCode } from "@/types";

/** Active staff member eligible to own exceptions. */
export interface StaffCandidate {
  id: string;
  fullName: string;
  role: RoleCode;
  /** Open exceptions + open tasks already assigned to this person. */
  workload: number;
}

export interface TriageDecision {
  assigneeId: string | null;
  assigneeName: string | null;
  role: RoleCode | null;
  /** Human-readable explanation stored on the exception row. */
  reason: string;
  /** Structured explanation for engine_decisions.reasons. */
  reasons: string[];
}

/**
 * Preferred staff role for each exception class — first match wins.
 * Money issues go to finance, identity/agent problems to operations,
 * schema/data problems to tech support, and anything unclassified routes
 * by severity.
 */
const TYPE_ROUTES: Record<string, RoleCode[]> = {
  unmatched_agent: ["operations", "admin"],
  unknown_external_id: ["operations", "admin"],
  invalid_currency: ["finance", "admin"],
  duplicate_transaction: ["operations", "finance", "admin"],
  negative_amount: ["finance", "admin"],
  schema_mismatch: ["tech_support", "admin"],
  missing_reference: ["operations", "admin"],
  variance_exceeds_threshold: ["finance", "admin"],
};

const SEVERITY_ROUTES: Record<EngineException["severity"], RoleCode[]> = {
  critical: ["admin", "super_admin"],
  high: ["finance", "operations", "admin"],
  medium: ["operations", "tech_support", "admin"],
  low: ["tech_support", "operations", "admin"],
};

/** Deterministic hash so ties always break the same way for a given id. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Pick the least-loaded candidate, ties broken by a stable hash. */
function pickLowestWorkload(candidates: StaffCandidate[], seed: string): StaffCandidate {
  return [...candidates].sort((a, b) => {
    const w = a.workload - b.workload;
    if (w !== 0) return w;
    return hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`);
  })[0];
}

/**
 * Decide which staff member should own an exception.
 * Returns nulls when no active staff exist (preview/offline) — the caller
 * then leaves the exception unassigned rather than fabricating a decision.
 */
export function triageException(
  exception: { id: string; type: string; severity: EngineException["severity"] },
  staff: StaffCandidate[]
): TriageDecision {
  const route = TYPE_ROUTES[exception.type] ?? SEVERITY_ROUTES[exception.severity];
  const reasons: string[] = [
    `exception type '${exception.type}' routes to ${route.join(" > ")}`,
    `severity: ${exception.severity}`,
  ];

  // Try each preferred role in order; take the least-loaded member.
  for (const role of route) {
    const candidates = staff.filter((s) => s.role === role);
    if (candidates.length) {
      const chosen = pickLowestWorkload(candidates, exception.id);
      reasons.push(
        `${chosen.fullName} selected as least-loaded ${role}` +
          ` (workload ${chosen.workload}, ${candidates.length} candidate${candidates.length === 1 ? "" : "s"})`
      );
      return {
        assigneeId: chosen.id,
        assigneeName: chosen.fullName,
        role: chosen.role,
        reason: reasons.join("; "),
        reasons,
      };
    }
    reasons.push(`no active staff with role '${role}'`);
  }

  // Last resort: least-loaded of any active staff member.
  if (staff.length) {
    const chosen = pickLowestWorkload(staff, exception.id);
    reasons.push(`fallback: least-loaded staff overall (${chosen.fullName}, workload ${chosen.workload})`);
    return {
      assigneeId: chosen.id,
      assigneeName: chosen.fullName,
      role: chosen.role,
      reason: reasons.join("; "),
      reasons,
    };
  }

  return {
    assigneeId: null,
    assigneeName: null,
    role: null,
    reason: "no active staff available — left unassigned",
    reasons,
  };
}
