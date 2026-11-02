import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runCycle, CYCLE_MODULES } from "@/lib/reconciliation/run-cycle";
import { deliverAgentRecon } from "@/lib/reconciliation/deliver";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/recon-auto — monthly auto-run scheduler.
 * Configure `crons` in vercel.json (1st of each month). Runs the previous
 * month's full cycle (1st → last day) for both modules, then optionally
 * sends the fresh documents to every agent — controlled by the
 * `recon_auto_monthly` system setting ({ enabled, send }).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: setting } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", "recon_auto_monthly")
    .maybeSingle();
  const cfg = (setting?.value ?? {}) as { enabled?: boolean; send?: boolean };
  if (!cfg.enabled) {
    return NextResponse.json({ ok: true, skipped: "auto-run disabled in settings" });
  }

  // Previous month — the cycle covers the 1st through the last day.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  // created_by needs a real profile — use the first super admin as the actor.
  const { data: actor } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  const actorId = actor?.id;
  if (!actorId) {
    return NextResponse.json({ error: "No super_admin profile to act as" }, { status: 500 });
  }

  const results = [];
  for (const m of CYCLE_MODULES) {
    results.push(await runCycle(sb, { module: m, period, actorId }));
  }

  // Optionally deliver the fresh documents to every agent.
  const deliveries: { batchId: string; sent: number; failed: number }[] = [];
  if (cfg.send) {
    for (const r of results.filter((r) => r.status === "done" && r.batchId)) {
      const { data: docs } = await sb
        .from("reconciliation_documents")
        .select("agent_id")
        .eq("batch_id", r.batchId!);
      const agentIds = [...new Set((docs ?? []).map((d) => d.agent_id))];
      let sent = 0;
      let failed = 0;
      for (const agentId of agentIds) {
        const res = await deliverAgentRecon({
          sb,
          batchId: r.batchId!,
          agentId,
          channels: ["email", "whatsapp"],
          origin: request.nextUrl.origin,
          deliveredBy: null,
        });
        if (res.success) sent++;
        else failed++;
      }
      deliveries.push({ batchId: r.batchId!, sent, failed });
    }
  }

  return NextResponse.json({ ok: true, period, results, deliveries });
}
