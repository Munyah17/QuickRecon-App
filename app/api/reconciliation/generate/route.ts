import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";
import { runReconciliationEngine } from "@/lib/reconciliation/engine";
import { generateAgentDocuments, documentToCSV } from "@/lib/reconciliation/document";
import type { ModuleCode } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isCompanyRole(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { module, period, sheets } = body;

    if (!module || !period || !sheets) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch agents and aliases from Supabase (or local data if not configured).
    const sb = await createServiceClient();
    let agents: { id: string; fullName: string; openingPosition?: number }[] = [];
    let aliases: { scheme: string; value: string; agentId: string }[] = [];

    if (sb) {
      const { data: agentsData } = await sb.from("agents").select("id, full_name, opening_position");
      agents =
        agentsData?.map((a) => ({
          id: a.id,
          fullName: a.full_name,
          openingPosition: a.opening_position ?? 0,
        })) ?? [];

      const { data: aliasData } = await sb.from("agent_external_ids").select("scheme, value, agent_id");
      aliases =
        aliasData?.map((a) => ({
          scheme: a.scheme,
          value: a.value,
          agentId: a.agent_id,
        })) ?? [];
    }

    // Fallback to local seed when Supabase is not configured.
    if (agents.length === 0) {
      const { getAgents } = await import("@/lib/data");
      const localAgents = await getAgents();
      agents = localAgents.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        openingPosition: 0,
      }));
    }

    const engineOutput = runReconciliationEngine({
      module: module as ModuleCode,
      period,
      sheets,
      agents,
      aliases,
    });

    const batchDocs = generateAgentDocuments(engineOutput);

    // Persist batch and documents to Supabase if available.
    if (sb) {
      await sb.from("reconciliation_batches").insert({
        id: batchDocs.batchId,
        module: batchDocs.module,
        period: batchDocs.period,
        generated_at: batchDocs.generatedAt,
        generated_by: session.user.id,
        status: "pending_review",
      });

      const rows = batchDocs.documents.map((d) => ({
        batch_id: batchDocs.batchId,
        agent_id: d.agentId,
        agent_name: d.agentName,
        module: d.module,
        period: d.period,
        currency: d.currency,
        opening_position: d.openingPosition,
        insurance: d.insurance,
        zinara: d.zinara,
        deposits: d.deposits,
        adjustments: d.adjustments,
        closing_position: d.closingPosition,
        status: d.status,
        csv_text: documentToCSV(d),
        created_at: d.generatedAt,
      }));

      await sb.from("reconciliation_documents").insert(rows);
    }

    return NextResponse.json({
      success: true,
      batchId: batchDocs.batchId,
      module: batchDocs.module,
      period: batchDocs.period,
      documentCount: batchDocs.documents.length,
      exceptions: engineOutput.exceptions,
    });
  } catch (error) {
    console.error("Generate reconciliation error:", error);
    return NextResponse.json({ error: "Failed to generate reconciliation documents" }, { status: 500 });
  }
}
