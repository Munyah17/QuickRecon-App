import type { IdentityAlias, IdentityMatch, NormalizedRecord } from "./types";

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
