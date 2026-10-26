import type { SupabaseClient } from "@supabase/supabase-js";
import { detectAnomalies } from "./anomaly";
import { computeBatchRiskScores, type AgentHistoryRow } from "./risk";
import { triageException, type StaffCandidate } from "./triage";
import type { EngineOutput } from "@/lib/reconciliation/types";

export interface EngineRunSummary {
  anomaliesInserted: number;
  riskScoresComputed: number;
  highRiskAgents: number;
  exceptionsAssigned: number;
  decisionsLogged: number;
  errors: string[];
}

interface RunContext {
  output: EngineOutput;
  batchId: string;
  importBatchId?: string | null;
  /** The exception rows just persisted — with their DB ids. */
  exceptionRows: { id: string; type: string; severity: string; agent_id: string | null }[];
  actorId?: string;
}

let seq = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${String(seq++ % 1000).padStart(3, "0")}`;

/**
 * The decision engine. Fully automatic, fully recorded: anomalies, risk
 * scores and exception assignments are all persisted, and every decision is
 * logged to engine_decisions with its reasons so it can be defended or
 * reversed later.
 */
export async function runDecisionEngine(
  sb: SupabaseClient,
  ctx: RunContext
): Promise<EngineRunSummary> {
  const { output, batchId } = ctx;
  const module = output.module;
  const period = output.period;
  const summary: EngineRunSummary = {
    anomaliesInserted: 0,
    riskScoresComputed: 0,
    highRiskAgents: 0,
    exceptionsAssigned: 0,
    decisionsLogged: 0,
    errors: [],
  };
  const decisions: Record<string, unknown>[] = [];
  const pushDecision = (
    kind: string,
    subjectType: string,
    subjectId: string,
    decision: Record<string, unknown>,
    reasons: unknown
  ) => {
    decisions.push({ id: newId("DEC"), kind, subject_type: subjectType, subject_id: subjectId, decision, reasons });
  };

  // --- Load context --------------------------------------------------------
  const [staffRes, taskRes, histRes, openExcRes] = await Promise.all([
    sb.from("profiles")
      .select("id, full_name, role, status")
      .in("role", ["super_admin", "admin", "tech_support", "finance", "operations"])
      .eq("status", "active"),
    sb.from("tasks")
      .select("assignee_id")
      .eq("assignee_type", "staff")
      .in("status", ["pending", "in_progress"]),
    sb.from("reconciliations")
      .select("agent_id, closing_position, status, deposits, insurance, period")
      .lt("period", period)
      .order("period", { ascending: false })
      .limit(2000),
    sb.from("reconciliation_exceptions")
      .select("agent_id, assignee")
      .in("status", ["open", "investigating"]),
  ]);

  const staffRows = staffRes.data ?? [];
  const taskRows = taskRes.data ?? [];
  const histRows = histRes.data ?? [];
  const openExcRows = openExcRes.data ?? [];

  // Workload = open exceptions + open tasks per staff member.
  const workload = new Map<string, number>();
  for (const e of openExcRows as { agent_id: string | null; assignee: string | null }[]) {
    if (e.assignee) workload.set(e.assignee, (workload.get(e.assignee) ?? 0) + 1);
  }
  for (const t of taskRows as { assignee_id: string }[]) {
    workload.set(t.assignee_id, (workload.get(t.assignee_id) ?? 0) + 1);
  }
  const staff: StaffCandidate[] = (staffRows as { id: string; full_name: string; role: string }[]).map((s) => ({
    id: s.id,
    fullName: s.full_name ?? "Staff",
    role: s.role as StaffCandidate["role"],
    workload: workload.get(s.id) ?? 0,
  }));

  const openExcByAgent = new Map<string, number>();
  for (const e of openExcRows as { agent_id: string | null }[]) {
    if (e.agent_id) openExcByAgent.set(e.agent_id, (openExcByAgent.get(e.agent_id) ?? 0) + 1);
  }

  const historyByAgent = new Map<string, AgentHistoryRow[]>();
  for (const h of histRows as { agent_id: string }[] & AgentHistoryRow[]) {
    const list = historyByAgent.get(h.agent_id) ?? [];
    if (list.length < 6) list.push(h);
    historyByAgent.set(h.agent_id, list);
  }

  // --- 1. Import anomalies -------------------------------------------------
  const anomalies = detectAnomalies(output.results, module);
  if (anomalies.length) {
    const rows = anomalies.map((a) => ({
      id: newId("ANO"),
      batch_id: batchId,
      import_batch_id: ctx.importBatchId ?? null,
      module,
      agent_id: a.agentId ?? null,
      kind: a.kind,
      severity: a.severity,
      details: a.details,
      status: "open",
    }));
    const { error } = await sb.from("import_anomalies").insert(rows);
    if (error) summary.errors.push(`import_anomalies: ${error.message}`);
    else {
      summary.anomaliesInserted = rows.length;
      for (const a of anomalies) {
        pushDecision("import_anomaly", "reconciliation_batches", batchId,
          { kind: a.kind, severity: a.severity, agentId: a.agentId }, a.details);
      }
      // High-severity anomalies escalate into the exception centre.
      const escalations = rows
        .filter((r) => r.severity === "high" || r.severity === "critical")
        .map((r) => ({
          id: newId("EXC"),
          batch_id: batchId,
          import_batch_id: ctx.importBatchId ?? null,
          module,
          agent_id: r.agent_id,
          type: "statistical_anomaly" as const,
          anomaly_kind: r.kind,
          severity: r.severity,
          source_ref: `anomaly:${r.id}`,
          description: anomalies.find((a) => a.kind === r.kind && a.agentId === r.agent_id)?.description ?? "Statistical anomaly detected.",
          status: "open",
        }));
      // Dedup escalations by (anomaly kind, agent)
      const seen = new Set<string>();
      const uniq = escalations.filter((e) => {
        const k = `${e.anomaly_kind}|${e.agent_id}`;
        return !seen.has(k) && void seen.add(k);
      });
      if (uniq.length) {
        const { error: escErr } = await sb.from("reconciliation_exceptions")
          .insert(uniq.map(({ anomaly_kind, ...rest }) => rest));
        if (escErr) summary.errors.push(`anomaly escalations: ${escErr.message}`);
        else ctx.exceptionRows.push(...uniq.map((e) => ({ id: e.id, type: e.type, severity: e.severity, agent_id: e.agent_id })));
      }
    }
  }

  // --- 2. Agent risk scores ------------------------------------------------
  const scores = computeBatchRiskScores(output.results, historyByAgent, openExcByAgent, module, period);
  if (scores.length) {
    const { error } = await sb.from("agent_risk_scores").upsert(
      scores.map((s) => ({
        agent_id: s.agentId,
        module: s.module,
        period: s.period,
        score: s.score,
        level: s.level,
        factors: s.factors,
      })),
      { onConflict: "agent_id,module,period" }
    );
    if (error) summary.errors.push(`agent_risk_scores: ${error.message}`);
    else {
      summary.riskScoresComputed = scores.length;
      summary.highRiskAgents = scores.filter((s) => s.level === "high" || s.level === "critical").length;
      for (const s of scores) {
        if (s.level !== "low") {
          pushDecision("risk_score", "agents", s.agentId,
            { score: s.score, level: s.level, period, module }, s.factors);
        }
      }
    }
  }

  // --- 3. Exception triage + assignment ------------------------------------
  const unassigned = ctx.exceptionRows.filter((e) => e.agent_id !== undefined);
  if (staff.length && unassigned.length) {
    const notify: Record<string, unknown>[] = [];
    for (const e of unassigned) {
      const t = triageException(
        { id: e.id, type: e.type, severity: e.severity as "critical" | "high" | "medium" | "low" },
        staff
      );
      if (!t.assigneeId) continue;
      const { error } = await sb.from("reconciliation_exceptions").update({
        assignee: t.assigneeId,
        assigned_by_engine: true,
        assignment_reason: t.reason,
        status: "investigating",
      }).eq("id", e.id).eq("status", "open");
      if (error) {
        summary.errors.push(`assign ${e.id}: ${error.message}`);
        continue;
      }
      summary.exceptionsAssigned++;
      // Reflect the new workload so subsequent picks stay balanced.
      const chosen = staff.find((s) => s.id === t.assigneeId);
      if (chosen) chosen.workload++;
      pushDecision("exception_assignment", "reconciliation_exceptions", e.id,
        { assigneeId: t.assigneeId, assigneeName: t.assigneeName, role: t.role }, t.reasons);
      notify.push({
        user_id: t.assigneeId,
        kind: "engine_assignment",
        title: `Exception assigned: ${e.type}`,
        body: `Auto-triaged to you — ${e.severity} severity. Reason: ${t.reason.slice(0, 180)}`,
      });
    }
    if (notify.length) {
      const { error: nErr } = await sb.from("notifications").insert(notify);
      if (nErr) summary.errors.push(`notifications: ${nErr.message}`);
    }
  }

  // --- 4. Record all decisions ---------------------------------------------
  if (decisions.length) {
    const { error } = await sb.from("engine_decisions").insert(decisions);
    if (error) summary.errors.push(`engine_decisions: ${error.message}`);
    else summary.decisionsLogged = decisions.length;
  }

  // --- 5. Audit row ---------------------------------------------------------
  await sb.from("audit_logs").insert({
    actor_id: ctx.actorId ?? null,
    action: "engine.run",
    entity: "reconciliation_batches",
    entity_id: batchId,
    next: {
      module, period,
      anomalies: summary.anomaliesInserted,
      riskScores: summary.riskScoresComputed,
      highRisk: summary.highRiskAgents,
      assignments: summary.exceptionsAssigned,
      errors: summary.errors.length,
    },
    module,
  });

  return summary;
}
