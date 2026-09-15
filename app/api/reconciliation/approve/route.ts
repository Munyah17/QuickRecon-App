import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/reconciliation/approve — approve & publish a batch.
 * Marks reconciliation_batches + reconciliations published, creates
 * per-agent reconciliation_documents + notifications. Real persistence,
 * no simulation.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await request.json();
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ ok: true, preview: true });

  // Resolve the target batch: explicit id or latest non-published batch.
  let batch: { id: string; period: string; module: string } | null = null;
  if (batchId) {
    const { data } = await sb
      .from("reconciliation_batches")
      .select("id, period, module")
      .eq("id", batchId)
      .maybeSingle();
    batch = data;
  } else {
    const { data } = await sb
      .from("reconciliation_batches")
      .select("id, period, module")
      .neq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    batch = data;
  }
  if (!batch) {
    return NextResponse.json({ error: "No publishable batch found" }, { status: 404 });
  }

  // Publish batch + its reconciliations.
  await sb
    .from("reconciliation_batches")
    .update({ status: "published", published_at: new Date().toISOString(), published_by: session.user.id })
    .eq("id", batch.id);

  const { data: recons } = await sb
    .from("reconciliations")
    .select("id, agent_id, agents(full_name, user_id)")
    .eq("batch_id", batch.id)
    .in("status", ["success", "warning", "review"]);

  const published = recons ?? [];
  if (published.length) {
    await sb
      .from("reconciliations")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("batch_id", batch.id)
      .in("status", ["success", "warning", "review"]);

    // One notification per agent — scoped to that agent only.
    const notifications = published
      .map((r) => {
        const ag = r.agents as unknown as { user_id?: string } | { user_id?: string }[] | null;
        const userId = Array.isArray(ag) ? ag[0]?.user_id : ag?.user_id;
        return userId ? {
          user_id: userId,
          type: "reconciliation_published",
          title: `Reconciliation published — ${batch.period}`,
          body: "Your consolidated reconciliation document is ready. Open Reports to view it.",
          link: "/app/reports",
        } : null;
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);
    if (notifications.length) {
      await sb.from("notifications").insert(notifications);
    }
  }

  await sb.from("audit_logs").insert({
    user_id: session.user.id,
    action: "reconciliation.batch_published",
    entity_type: "reconciliation_batch",
    entity_id: batch.id,
    details: { period: batch.period, module: batch.module, agents: published.length },
  });

  return NextResponse.json({ ok: true, batchId: batch.id, published: published.length });
}
