import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleCode } from "@/types";
import { companyAliasScheme } from "@/lib/reconciliation/identity-resolver";

/**
 * ZINARA codes are shared by business arrangement — several agents may
 * legitimately trade through the same ZINARA account, or through one that
 * belongs to a colleague. They are NOT a unique identity: the uniqueness
 * index on agent_external_ids deliberately excludes these schemes.
 */
export const SHARED_ID_SCHEMES = new Set(["zinara_user", "zinara_id"]);

export interface ExternalIdRow {
  agent_id: string;
  scheme: string;
  value: string;
}

export interface ClaimResult {
  inserted: number;
  /** Codes claimed by another agent and left untouched (reassign = false). */
  skipped: string[];
  error?: string;
}

/**
 * Insert external-ID rows honouring per-scheme sharing rules:
 *  - shared schemes (ZINARA) always insert — the same code may sit on
 *    several agents; same-agent duplicates are skipped.
 *  - unique schemes skip codes already claimed by another agent, unless
 *    `reassign` is set (super admin), in which case the claim moves.
 * Implemented as select + insert because the partial unique index has no
 * usable ON CONFLICT arbiter.
 */
export async function claimExternalIds(
  sb: SupabaseClient,
  rows: ExternalIdRow[],
  opts?: { reassign?: boolean; abortOnSkip?: boolean }
): Promise<ClaimResult> {
  const deduped = new Map<string, ExternalIdRow>();
  for (const r of rows) {
    const k = `${r.scheme}|${r.value.trim().toUpperCase()}`;
    if (r.value.trim() && !deduped.has(k)) deduped.set(k, { ...r, value: r.value.trim() });
  }
  const wanted = [...deduped.values()];
  const result: ClaimResult = { inserted: 0, skipped: [] };
  if (!wanted.length) return result;

  const { data: existing, error: readErr } = await sb
    .from("agent_external_ids")
    .select("id, agent_id, scheme, value")
    .in("value", [...new Set(wanted.map((r) => r.value))]);
  if (readErr) return { ...result, error: readErr.message };

  const claimed = new Map<string, { id: number; agent_id: string }>();
  for (const e of existing ?? []) {
    claimed.set(`${e.scheme}|${e.value.trim().toUpperCase()}`, { id: e.id, agent_id: e.agent_id });
  }

  const toInsert: ExternalIdRow[] = [];
  const stealIds: number[] = [];
  for (const r of wanted) {
    const hit = claimed.get(`${r.scheme}|${r.value.toUpperCase()}`);
    if (hit && hit.agent_id === r.agent_id) continue; // already owned
    if (hit && !SHARED_ID_SCHEMES.has(r.scheme)) {
      if (!opts?.reassign) {
        result.skipped.push(r.value);
        continue;
      }
      stealIds.push(hit.id); // super admin: claim moves to this agent
    }
    toInsert.push(r);
  }

  if (opts?.abortOnSkip && result.skipped.length) return result;

  if (stealIds.length) {
    const { error: delErr } = await sb.from("agent_external_ids").delete().in("id", stealIds);
    if (delErr) return { ...result, error: delErr.message };
  }
  if (toInsert.length) {
    const { error: insErr } = await sb.from("agent_external_ids").insert(toInsert);
    if (insErr) return { ...result, error: insErr.message };
    result.inserted = toInsert.length;
  }
  return result;
}

/**
 * Persist agent codes the engine learned from name-matched rows under the
 * module's company scheme. Never re-points a claimed code.
 */
export async function persistLearnedAliases(
  sb: SupabaseClient,
  module: ModuleCode,
  learned: { agentId: string; value: string }[]
): Promise<ClaimResult> {
  if (!learned.length) return { inserted: 0, skipped: [] };
  const scheme = companyAliasScheme(module);
  const res = await claimExternalIds(
    sb,
    learned.map((a) => ({ agent_id: a.agentId, scheme, value: a.value }))
  );
  if (res.error) console.error("learned alias persist failed:", res.error);
  return res;
}
