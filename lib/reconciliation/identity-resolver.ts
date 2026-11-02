import type { ModuleCode } from "@/types";
import type { IdentityAlias, IdentityMatch, NormalizedRecord } from "./types";

/** agent_external_ids scheme for a module's own worksheet agent codes. */
export function companyAliasScheme(module: ModuleCode): string {
  return module === "econet-moovah" ? "econet_id" : "enpassent_user_id";
}

/**
 * Name keys are deliberately never a sole trusted identifier — a fuzzy
 * name match only yields "name" confidence and goes to exceptions.
 */
export class IdentityResolver {
  private aliasIndex = new Map<string, string>();

  constructor(aliases: IdentityAlias[]) {
    for (const a of aliases) {
      this.aliasIndex.set(IdentityResolver.key(a.value), a.agentId);
    }
  }

  static key(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, "");
  }

  /**
   * Record a code → agent mapping discovered during this run (e.g. a row
   * matched by name also carries the agent's company code). Later rows with
   * the same code then resolve by alias. Never overwrites a code already
   * claimed — a claimed code is another agent's identity.
   */
  learn(externalId: string, agentId: string): void {
    const key = IdentityResolver.key(externalId);
    if (key && !this.aliasIndex.has(key)) this.aliasIndex.set(key, agentId);
  }

  resolve(record: NormalizedRecord): IdentityMatch {
    // 1. Exact external identifier (strongest).
    if (record.externalId) {
      const hit = this.aliasIndex.get(IdentityResolver.key(record.externalId));
      if (hit) return { record, agentId: hit, confidence: "alias" };
    }
    // 2. Direct agent code.
    if (record.externalId && /^AGT-\d+$/i.test(record.externalId)) {
      return {
        record,
        agentId: record.externalId.toUpperCase(),
        confidence: "exact",
      };
    }
    // 3. Name hint is never auto-trusted.
    if (record.agentNameHint) {
      return { record, confidence: "name" };
    }
    return { record, confidence: "none" };
  }

  resolveAll(records: NormalizedRecord[]): IdentityMatch[] {
    return records.map((r) => this.resolve(r));
  }
}
