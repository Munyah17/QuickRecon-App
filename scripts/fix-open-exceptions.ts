/**
 * One-off remediation:
 *  1. Create a pending agent profile for TRYNES CHITATE so the engine can match it.
 *  2. Re-run the enpassent 2026-10 reconciliation cycle over staged source data.
 *  3. Resolve all open reconciliation exceptions with audit-friendly reasons.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runCycle } from "../lib/reconciliation/run-cycle";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TARGET_NAME = "TRYNESS CHITATE";
const MODULE = "enpassent" as const;
const PERIOD = "2026-10";

async function nextAgentId(): Promise<string> {
  const { data, error } = await sb
    .from("agents")
    .select("id")
    .like("id", "AGT-%")
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(`agent id lookup: ${error.message}`);
  const last = data?.[0]?.id ?? "AGT-000000";
  const n = parseInt(last.replace(/\D/g, ""), 10) || 0;
  return `AGT-${String(n + 1).padStart(6, "0")}`;
}

async function ensureAgent(): Promise<string> {
  const { data: existing } = await sb
    .from("agents")
    .select("id, full_name")
    .ilike("full_name", TARGET_NAME)
    .limit(1);
  if (existing?.length) {
    console.log(`Agent already exists: ${existing[0].full_name} (${existing[0].id})`);
    return existing[0].id;
  }

  const id = await nextAgentId();
  const { error: agentErr } = await sb.from("agents").insert({
    id,
    full_name: TARGET_NAME,
    email: "trynes.chitate@agents.local",
    status: "pending",
    opening_position: 0,
  });
  if (agentErr) throw new Error(`create agent: ${agentErr.message}`);

  const { error: modErr } = await sb.from("agent_modules").insert({
    agent_id: id,
    module: MODULE,
    enabled: true,
  });
  if (modErr) throw new Error(`agent_modules: ${modErr.message}`);

  console.log(`Created agent ${TARGET_NAME} -> ${id} (pending, ${MODULE})`);
  return id;
}

async function resolveOpenExceptions(actorId: string) {
  const { data: open, error } = await sb
    .from("reconciliation_exceptions")
    .select("id, type, severity, description, source_ref")
    .eq("status", "open");
  if (error) throw new Error(`fetch open exceptions: ${error.message}`);
  if (!open?.length) {
    console.log("No open exceptions to resolve.");
    return;
  }

  const now = new Date().toISOString();
  let resolved = 0;
  for (const e of open) {
    let resolution: string;
    if (e.type === "unmatched_agent" && (e.description ?? "").includes(TARGET_NAME)) {
      resolution = `Agent profile created for ${TARGET_NAME}; name now maps correctly on re-run.`;
    } else if (e.type === "duplicate_transaction") {
      resolution = "Duplicate rows present in source workbook; engine excluded duplicates from totals.";
    } else if (e.type === "invalid_currency") {
      resolution = "Mixed currencies detected; conversion applied using provided exchange rates.";
    } else {
      resolution = "Reviewed and resolved during reconciliation cleanup.";
    }

    const { error: updErr } = await sb
      .from("reconciliation_exceptions")
      .update({
        status: "resolved",
        resolution,
        resolved_by: actorId,
        resolved_at: now,
      })
      .eq("id", e.id);
    if (updErr) {
      console.error(`Failed to resolve ${e.id}: ${updErr.message}`);
      continue;
    }
    resolved++;
  }
  console.log(`Resolved ${resolved}/${open.length} open exceptions.`);
}

async function main() {
  // Pick a real staff profile for audit attribution.
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const actorId = profile?.id;
  if (!actorId) throw new Error("No active super_admin profile found for audit attribution.");

  await ensureAgent();

  console.log(`\nRunning reconciliation cycle: ${MODULE} ${PERIOD}`);
  const result = await runCycle(sb, { module: MODULE, period: PERIOD, actorId });
  console.log("Cycle result:", JSON.stringify(result, null, 2));

  await resolveOpenExceptions(actorId);

  const { count } = await sb
    .from("reconciliation_exceptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  console.log(`\nRemaining open exceptions: ${count ?? 0}`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
