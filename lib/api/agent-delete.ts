import type { SupabaseClient } from "@supabase/supabase-js";
import { fkConflictMessage } from "@/lib/api/fk-conflict";

export interface AgentDeleteResult {
  deleted: boolean;
  /** Human-readable failure — FK-conflict hint where applicable. */
  error?: string;
  /** True when the delete was blocked by foreign-key references (409). */
  conflict?: boolean;
  /** Cleanup steps that failed before the delete (the delete itself is the gate). */
  cleanupFailures?: string[];
}

/**
 * Permanently delete one agent and every linked record — shared by the
 * single-agent DELETE and the bulk directory delete so both enforce the
 * same dependency order.
 *
 * FK-restricted dependents are purged children-first; audit-preserving
 * references that allow NULL are detached instead of deleted so
 * exception/ticket/batch history survives. Cascade-declared dependents
 * (booths, assistants, external ids, modules, submissions, recon
 * lines/versions/adjustments) go with the agent.
 */
export async function deleteAgentCascade(
  service: SupabaseClient,
  id: string
): Promise<AgentDeleteResult> {
  // Steps run in order; failures are collected — the agents delete below is
  // the real gate and reports whichever table is still blocking.
  const steps: { label: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
    // Polymorphic owner link — no FK, orphans would survive.
    { label: "payment_methods", run: () => service.from("payment_methods").delete().eq("owner_type", "agent").eq("owner_id", id) },
    // FK-restricted dependents — must go before agents.delete.
    { label: "reconciliation_deliveries", run: () => service.from("reconciliation_deliveries").delete().eq("agent_id", id) },
    { label: "reconciliation_documents", run: () => service.from("reconciliation_documents").delete().eq("agent_id", id) },
    // reports.reconciliation_id also restricts the reconciliations delete.
    { label: "reports", run: () => service.from("reports").delete().eq("agent_id", id) },
    // Cascades reconciliation_lines, _versions, _adjustments, agent_discrepancies.
    { label: "reconciliations", run: () => service.from("reconciliations").delete().eq("agent_id", id) },
    { label: "distribution_recipients", run: () => service.from("distribution_recipients").delete().eq("agent_id", id) },
    // Nullable references — detach rather than delete so batch/exception/
    // ticket history keeps its audit trail.
    { label: "reconciliation_exceptions", run: () => service.from("reconciliation_exceptions").update({ agent_id: null }).eq("agent_id", id) },
    { label: "support_tickets", run: () => service.from("support_tickets").update({ agent_id: null }).eq("agent_id", id) },
    { label: "normalised_records", run: () => service.from("normalised_records").update({ agent_id: null }).eq("agent_id", id) },
    // The agent's login profile survives — just unlinked.
    { label: "profiles", run: () => service.from("profiles").update({ agent_id: null }).eq("agent_id", id) },
  ];

  const cleanupFailures: string[] = [];
  for (const step of steps) {
    const { error } = await step.run();
    if (error) {
      // A missing table/column in a partially-migrated env shouldn't block
      // the delete — FK on agents is what actually enforces linkage.
      console.error(`agent delete: ${step.label} cleanup failed: ${error.message}`);
      cleanupFailures.push(step.label);
    }
  }

  const { error } = await service.from("agents").delete().eq("id", id);
  if (error) {
    const friendly = fkConflictMessage(error, "agent", "set it to Inactive");
    return {
      deleted: false,
      conflict: Boolean(friendly),
      cleanupFailures,
      error: friendly ?? error.message,
    };
  }
  return { deleted: true, cleanupFailures };
}
