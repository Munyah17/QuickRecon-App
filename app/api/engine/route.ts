import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { triageException, type StaffCandidate } from "@/lib/engine/triage";

export const runtime = "nodejs";

/**
 * GET /api/engine — engine state for dashboards/exception centre.
 * Returns open anomalies, latest risk levels and recent decisions.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const [anomalies, risks, decisions] = await Promise.all([
    sb.from("import_anomalies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100),
    sb.from("agent_risk_scores")
      .select("agent_id, module, period, score, level, factors, computed_at, agents(full_name)")
      .order("computed_at", { ascending: false })
      .limit(500),
    sb.from("engine_decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Collapse risk scores to the latest row per agent+module.
  const latestRisk = new Map<string, Record<string, unknown>>();
  for (const r of (risks.data ?? []) as Record<string, unknown>[]) {
    const key = `${r.agent_id}|${r.module}`;
    if (!latestRisk.has(key)) latestRisk.set(key, r);
  }

  return NextResponse.json({
    anomalies: anomalies.data ?? [],
    riskScores: [...latestRisk.values()],
    decisions: decisions.data ?? [],
    error: anomalies.error?.message ?? risks.error?.message ?? decisions.error?.message ?? null,
  });
}

/**
 * POST /api/engine — re-triage all unassigned open exceptions.
 * Used when staff rosters change or a run was interrupted. Idempotent:
 * only open, unassigned exceptions are touched.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "retriage");
  if (action !== "retriage") {
    return NextResponse.json({ error: "Unknown action — supported: retriage" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: staffRows } = await sb
    .from("profiles")
    .select("id, full_name, role, status")
    .in("role", ["super_admin", "admin", "tech_support", "finance", "operations"])
    .eq("status", "active");
  const { data: openExc } = await sb
    .from("reconciliation_exceptions")
    .select("id, type, severity, assignee")
    .eq("status", "open");
  const { data: taskRows } = await sb
    .from("tasks")
    .select("assignee_id")
    .eq("assignee_type", "staff")
    .in("status", ["pending", "in_progress"]);

  const workload = new Map<string, number>();
  for (const e of (openExc ?? []) as { assignee: string | null }[]) {
    if (e.assignee) workload.set(e.assignee, (workload.get(e.assignee) ?? 0) + 1);
  }
  for (const t of (taskRows ?? []) as { assignee_id: string }[]) {
    workload.set(t.assignee_id, (workload.get(t.assignee_id) ?? 0) + 1);
  }
  const staff: StaffCandidate[] = ((staffRows ?? []) as { id: string; full_name: string; role: string }[]).map((s) => ({
    id: s.id,
    fullName: s.full_name ?? "Staff",
    role: s.role as StaffCandidate["role"],
    workload: workload.get(s.id) ?? 0,
  }));

  const unassigned = ((openExc ?? []) as { id: string; type: string; severity: string; assignee: string | null }[])
    .filter((e) => !e.assignee);

  let assigned = 0;
  const decisions: Record<string, unknown>[] = [];
  let i = 0;
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
    if (error) continue;
    assigned++;
    const chosen = staff.find((s) => s.id === t.assigneeId);
    if (chosen) chosen.workload++;
    decisions.push({
      id: `DEC-${Date.now().toString(36)}-${String(i++).padStart(3, "0")}`,
      kind: "exception_assignment",
      subject_type: "reconciliation_exceptions",
      subject_id: e.id,
      decision: { assigneeId: t.assigneeId, assigneeName: t.assigneeName, role: t.role },
      reasons: t.reasons,
    });
    await sb.from("notifications").insert({
      user_id: t.assigneeId,
      kind: "engine_assignment",
      title: `Exception assigned: ${e.type}`,
      body: `Auto-triaged to you — ${e.severity} severity. Reason: ${t.reason.slice(0, 180)}`,
    });
  }
  if (decisions.length) await sb.from("engine_decisions").insert(decisions);

  await sb.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "engine.retriage",
    entity: "reconciliation_exceptions",
    next: { assigned, scanned: unassigned.length },
  });

  return NextResponse.json({ ok: true, assigned, scanned: unassigned.length });
}
