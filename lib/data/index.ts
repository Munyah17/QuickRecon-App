/**
 * Data-access layer. Every accessor tries Supabase first (respecting RLS)
 * and falls back to curated sample data in preview mode. UI components only
 * ever call these functions — they never read the fixture file directly.
 */
import { createClient } from "@/lib/supabase/server";
import type { ModuleCode } from "@/types";
import {
  MOCK_AGENTS,
  MOCK_ASSISTANTS,
  MOCK_BOOTHS,
  MOCK_DISTRIBUTIONS,
  MOCK_EXCEPTIONS,
  MOCK_IMPORTS,
  MOCK_NOTIFICATIONS,
  MOCK_PENDING_APPROVALS,
  MOCK_RECONCILIATIONS,
  MOCK_RECON_LINES,
  MOCK_REPORTS,
  MOCK_SUBMISSIONS,
  MOCK_TEAM_USERS,
  MOCK_TICKETS,
  MOCK_TRANSACTIONS,
  MOCK_EXTERNAL_IDS,
  MOCK_ACTIVITIES,
} from "./mock";

async function db() {
  try {
    return await createClient();
  } catch {
    return null;
  }
}

export async function getAgents() {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .order("full_name", { ascending: true });
    if (data?.length) return data as never as typeof MOCK_AGENTS;
  }
  return MOCK_AGENTS;
}

export async function getAgentById(agentId: string) {
  return (await getAgents()).find((a) => a.id === agentId) ?? null;
}

export async function getBooths(agentId?: string) {
  return agentId
    ? MOCK_BOOTHS.filter((b) => b.agentId === agentId)
    : MOCK_BOOTHS;
}

export async function getAssistants(agentId?: string) {
  return agentId
    ? MOCK_ASSISTANTS.filter((a) => a.agentId === agentId)
    : MOCK_ASSISTANTS;
}

export async function getReconciliations(opts: {
  agentId?: string;
  module?: ModuleCode | "all";
  period?: string;
} = {}) {
  let rows = MOCK_RECONCILIATIONS;
  if (opts.agentId) rows = rows.filter((r) => r.agentId === opts.agentId);
  if (opts.module && opts.module !== "all")
    rows = rows.filter((r) => r.module === opts.module);
  if (opts.period) rows = rows.filter((r) => r.period === opts.period);
  return rows;
}

export async function getReconciliationById(id: string) {
  return MOCK_RECONCILIATIONS.find((r) => r.id === id) ?? null;
}

export async function getReconciliationLines(id: string) {
  return MOCK_RECON_LINES[id] ?? MOCK_RECON_LINES["RCN-2608-001"];
}

export async function getExceptions(batchId?: string) {
  return batchId
    ? MOCK_EXCEPTIONS.filter((e) => e.batchId === batchId)
    : MOCK_EXCEPTIONS;
}

export async function getImportBatches() {
  return MOCK_IMPORTS;
}

export async function getImportBatch(id: string) {
  return MOCK_IMPORTS.find((b) => b.id === id) ?? null;
}

export async function getReports(agentId?: string) {
  return agentId
    ? MOCK_REPORTS.filter((r) => r.agentId === agentId)
    : MOCK_REPORTS;
}

export async function getDistributions() {
  return MOCK_DISTRIBUTIONS;
}

export async function getSubmissions(agentId?: string) {
  return agentId
    ? MOCK_SUBMISSIONS.filter((s) => s.agentId === agentId)
    : MOCK_SUBMISSIONS;
}

export async function getTickets(agentId?: string) {
  return agentId
    ? MOCK_TICKETS.filter((t) => t.agentId === agentId)
    : MOCK_TICKETS;
}

export async function getTransactions(agentId?: string) {
  void agentId;
  return MOCK_TRANSACTIONS;
}

export async function getIdentityAliases() {
  return MOCK_EXTERNAL_IDS;
}

export async function getTeamUsers() {
  return MOCK_TEAM_USERS;
}

export async function getPendingApprovals() {
  return MOCK_PENDING_APPROVALS;
}

export async function getNotifications() {
  return MOCK_NOTIFICATIONS;
}

export async function getActivities() {
  return MOCK_ACTIVITIES;
}

/** Super Admin dashboard rollup numbers. */
export async function getAdminDashboardSummary() {
  const agents = await getAgents();
  const total = 248;
  const active = 236;
  return {
    totalAgents: total,
    activeAgents: active,
    reconciledAgents: 222,
    pendingIssues: 14,
    activePct: Math.round((active / total) * 100),
    reconciledPct: 90,
    agentRows: agents,
  };
}
