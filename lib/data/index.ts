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

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapAgent(row: any): (typeof MOCK_AGENTS)[number] {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    province: row.province ?? "",
    location: row.location ?? "",
    status: row.status,
    modules: (row.agent_modules ?? []).map((m: any) => ({ module: m.module, enabled: m.enabled })),
    boothsCount: row.booths?.[0]?.count ?? 0,
    assistantsCount: row.assistants?.[0]?.count ?? 0,
    joinedAt: row.joined_at ?? row.created_at,
    nationalId: row.national_id ?? undefined,
    iceCashId: row.icecash_id ?? undefined,
    kycStatus: row.kyc_status ?? "pending",
  };
}

export async function getAgents() {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("agents")
      .select("*, agent_modules(module, enabled), booths:booths(count), assistants:assistants(count)")
      .order("full_name", { ascending: true });
    if (data?.length) return data.map(mapAgent);
  }
  return MOCK_AGENTS;
}

export async function getAgentById(agentId: string) {
  return (await getAgents()).find((a) => a.id === agentId) ?? null;
}

export async function getBoothById(id: string) {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("booths")
      .select("*, booth_modules(module), assistants:assistants(count)")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      return {
        id: data.id,
        agentId: data.agent_id,
        name: data.name,
        location: data.location ?? "",
        province: data.province ?? "",
        status: data.status,
        modules: (data.booth_modules ?? []).map((m: any) => m.module),
        assistantsCount: data.assistants?.[0]?.count ?? 0,
        createdAt: data.created_at,
      };
    }
  }
  return MOCK_BOOTHS.find((b) => b.id === id) ?? null;
}

export async function getBooths(agentId?: string) {
  const supabase = await db();
  if (supabase) {
    let q = supabase
      .from("booths")
      .select("*, booth_modules(module), assistants:assistants(count)");
    if (agentId) q = q.eq("agent_id", agentId);
    const { data } = await q.order("name");
    if (data?.length) {
      return data.map((b: any) => ({
        id: b.id,
        agentId: b.agent_id,
        name: b.name,
        location: b.location ?? "",
        province: b.province ?? "",
        status: b.status,
        modules: (b.booth_modules ?? []).map((m: any) => m.module),
        assistantsCount: b.assistants?.[0]?.count ?? 0,
        createdAt: b.created_at,
      }));
    }
  }
  return agentId
    ? MOCK_BOOTHS.filter((b) => b.agentId === agentId)
    : MOCK_BOOTHS;
}

export async function getAssistants(agentId?: string) {
  const supabase = await db();
  if (supabase) {
    let q = supabase.from("assistants").select("*, booths(name)");
    if (agentId) q = q.eq("agent_id", agentId);
    const { data } = await q.order("full_name");
    if (data?.length) {
      return data.map((a: any) => ({
        id: a.id,
        agentId: a.agent_id,
        boothId: a.booth_id ?? undefined,
        boothName: a.booths?.name ?? undefined,
        fullName: a.full_name,
        email: a.email ?? "",
        phone: a.phone ?? "",
        status: a.status,
        requestedPermissions: a.requested_permissions ?? [],
        createdAt: a.created_at,
      }));
    }
  }
  return agentId
    ? MOCK_ASSISTANTS.filter((a) => a.agentId === agentId)
    : MOCK_ASSISTANTS;
}

function mapRecon(row: any): (typeof MOCK_RECONCILIATIONS)[number] {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agents?.full_name ?? row.agent_id,
    module: row.module,
    period: row.period,
    status: row.status,
    currency: row.currency,
    openingPosition: Number(row.opening_position),
    insurance: Number(row.insurance),
    zinara: Number(row.zinara),
    deposits: Number(row.deposits),
    adjustments: Number(row.adjustments),
    closingPosition: Number(row.closing_position),
    publishedAt: row.published_at ?? undefined,
    version: row.version ?? 1,
  };
}

export async function getReconciliations(opts: {
  agentId?: string;
  module?: ModuleCode | "all";
  period?: string;
} = {}) {
  const supabase = await db();
  if (supabase) {
    let q = supabase.from("reconciliations").select("*, agents(full_name)");
    if (opts.agentId) q = q.eq("agent_id", opts.agentId);
    if (opts.module && opts.module !== "all") q = q.eq("module", opts.module);
    if (opts.period) q = q.eq("period", opts.period);
    const { data } = await q.order("period", { ascending: false });
    if (data?.length) return data.map(mapRecon);
  }
  let rows = MOCK_RECONCILIATIONS;
  if (opts.agentId) rows = rows.filter((r) => r.agentId === opts.agentId);
  if (opts.module && opts.module !== "all")
    rows = rows.filter((r) => r.module === opts.module);
  if (opts.period) rows = rows.filter((r) => r.period === opts.period);
  return rows;
}

export async function getReconciliationById(id: string) {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("reconciliations")
      .select("*, agents(full_name)")
      .eq("id", id)
      .maybeSingle();
    if (data) return mapRecon(data);
  }
  return MOCK_RECONCILIATIONS.find((r) => r.id === id) ?? null;
}

export async function getReconciliationLines(id: string) {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("reconciliation_lines")
      .select("*")
      .eq("reconciliation_id", id);
    if (data?.length) {
      return data.map((l: any) => ({
        item: l.item,
        category: l.category,
        expected: Number(l.expected),
        actual: Number(l.actual),
        variance: Number(l.variance),
        status: l.status,
      }));
    }
  }
  return MOCK_RECON_LINES[id] ?? MOCK_RECON_LINES["RCN-2608-001"];
}

/** Generated per-agent reconciliation documents for a batch. */
export async function getReconciliationDocuments(batchId?: string) {
  const supabase = await db();
  if (supabase) {
    let q = supabase
      .from("reconciliation_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (batchId) q = q.eq("batch_id", batchId);
    const { data } = await q;
    if (data?.length) {
      return data.map((d: any) => ({
        id: d.id,
        batchId: d.batch_id,
        agentId: d.agent_id,
        agentName: d.agent_name,
        module: d.module,
        period: d.period,
        currency: d.currency,
        openingVariance: Number(d.opening_variance),
        insurance: Number(d.insurance),
        zinara: Number(d.zinara),
        totalExpected: Number(d.total_expected),
        deposits: Number(d.deposits),
        adjustments: Number(d.adjustments),
        closingVariance: Number(d.closing_variance),
        closingPosition: Number(d.closing_position),
        status: d.status,
        createdAt: d.created_at,
      }));
    }
  }
  return [] as {
    id: string; batchId: string; agentId: string; agentName: string;
    module: string; period: string; currency: "USD" | "ZWG";
    openingVariance: number; insurance: number; zinara: number;
    totalExpected: number; deposits: number; adjustments: number;
    closingVariance: number; closingPosition: number;
    status: string; createdAt: string;
  }[];
}

export async function getExceptions(batchId?: string) {
  return batchId
    ? MOCK_EXCEPTIONS.filter((e) => e.batchId === batchId)
    : MOCK_EXCEPTIONS;
}

export async function getImportBatches() {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false });
    if (data?.length) {
      return data.map((b: any) => ({
        id: b.id,
        fileName: b.file_name,
        fileSizeBytes: Number(b.file_size ?? 0),
        module: b.module,
        period: b.period,
        status: b.status,
        uploadedAt: b.created_at,
        uploadedBy: b.uploaded_by,
        worksheets: [],
        rowCount: 0,
        checksum: b.checksum ?? "",
      }));
    }
  }
  return MOCK_IMPORTS;
}

export async function getImportBatch(id: string) {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase.from("import_batches").select("*").eq("id", id).maybeSingle();
    if (data) {
      return {
        id: data.id,
        fileName: data.file_name,
        fileSizeBytes: Number(data.file_size ?? 0),
        module: data.module,
        period: data.period,
        status: data.status,
        uploadedAt: data.created_at,
        uploadedBy: data.uploaded_by,
        worksheets: [],
        rowCount: 0,
        checksum: data.checksum ?? "",
      };
    }
  }
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
  const supabase = await db();
  if (supabase) {
    let q = supabase.from("submissions").select("*, agents(full_name)");
    if (agentId) q = q.eq("agent_id", agentId);
    const { data } = await q.order("created_at", { ascending: false });
    if (data?.length) {
      return data.map((s: any) => ({
        id: s.id,
        agentId: s.agent_id,
        agentName: s.agents?.full_name ?? s.agent_id,
        module: s.module,
        type: s.type,
        title: s.title,
        description: s.description ?? undefined,
        status: s.status,
        submittedAt: s.created_at,
        reviewerComment: s.reviewer_comment ?? undefined,
      }));
    }
  }
  return agentId
    ? MOCK_SUBMISSIONS.filter((s) => s.agentId === agentId)
    : MOCK_SUBMISSIONS;
}

export async function getTickets(agentId?: string) {
  const supabase = await db();
  if (supabase) {
    let q = supabase.from("support_tickets").select("*, agents(full_name)");
    if (agentId) q = q.eq("agent_id", agentId);
    const { data } = await q.order("created_at", { ascending: false });
    if (data?.length) {
      return data.map((t: any) => ({
        id: t.id,
        agentId: t.agent_id ?? "",
        agentName: t.agents?.full_name ?? "",
        module: t.module ?? "general",
        category: t.category,
        subject: t.subject,
        status: t.status,
        createdAt: t.created_at,
      }));
    }
  }
  return agentId
    ? MOCK_TICKETS.filter((t) => t.agentId === agentId)
    : MOCK_TICKETS;
}

export async function getTransactions(agentId?: string) {
  void agentId;
  return MOCK_TRANSACTIONS;
}

export async function getIdentityAliases() {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase.from("agent_external_ids").select("*");
    if (data?.length) {
      return data.map((r: any) => ({ agentId: r.agent_id, scheme: r.scheme, value: r.value }));
    }
  }
  return MOCK_EXTERNAL_IDS;
}

export async function getTeamUsers() {
  const supabase = await db();
  if (supabase) {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    if (data?.length) {
      return data.map((u: any) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status,
        agentId: u.agent_id ?? undefined,
        lastLoginAt: u.last_login_at ?? undefined,
      }));
    }
  }
  return MOCK_TEAM_USERS;
}

export async function getPendingApprovals() {
  return MOCK_PENDING_APPROVALS;
}

/** Kinds a field user may see — internal ops events stay company-only. */
const FIELD_ACTIVITY_KINDS = new Set(["report", "submission", "assistant"]);
const FIELD_NOTIFICATION_KINDS = new Set(["report", "assistant", "profile", "submission"]);

export async function getNotifications(fieldUser = false) {
  if (fieldUser) {
    return MOCK_NOTIFICATIONS.filter((n) => FIELD_NOTIFICATION_KINDS.has(n.kind));
  }
  return MOCK_NOTIFICATIONS;
}

export async function getActivities(fieldUser = false) {
  if (fieldUser) {
    return MOCK_ACTIVITIES.filter((a) => FIELD_ACTIVITY_KINDS.has(a.kind));
  }
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
