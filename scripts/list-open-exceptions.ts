/** READ-ONLY: list open reconciliation exceptions grouped by type/severity. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await sb
    .from("reconciliation_exceptions")
    .select("id, type, severity, module, agent_id, source_ref, description, status, created_at, agents(full_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  console.log(`OPEN EXCEPTIONS: ${rows.length}`);

  const byType = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    bySeverity.set(r.severity, (bySeverity.get(r.severity) ?? 0) + 1);
  }
  console.log("\nBY TYPE:");
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log("\nBY SEVERITY:");
  for (const [k, v] of [...bySeverity.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

  console.log("\nALL:");
  for (const r of rows) {
    const agent = (r as any).agents?.full_name ?? r.agent_id ?? "-";
    console.log(`  [${r.severity}] ${r.type} | ${agent} | ${r.source_ref ?? ""} | ${(r.description ?? "").slice(0, 100)}`);
  }

  // Look up agents that might match unmatched names in exceptions.
  const unmatchedNames = new Set<string>();
  for (const r of rows.filter((x) => x.type === "unmatched_agent")) {
    const m = (r.description ?? "").match(/Name "([^"]+)"/);
    if (m) unmatchedNames.add(m[1]);
  }
  if (unmatchedNames.size) {
    console.log("\nAGENT LOOKUP FOR UNMATCHED NAMES:");
    for (const name of unmatchedNames) {
      const parts = name.split(/\s+/).filter(Boolean);
      const term = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const { data: agents } = await sb
        .from("agents")
        .select("id, full_name, status")
        .ilike("full_name", `%${term}%`)
        .limit(10);
      console.log(`  "${name}":`);
      for (const a of agents ?? []) console.log(`    - ${a.full_name} (${a.status}) id=${a.id}`);
      if (!agents?.length) console.log("    (no similar agents found)");
    }
  }
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
