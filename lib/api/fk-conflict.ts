import { NextResponse } from "next/server";

/**
 * Translate a Postgres foreign-key restriction error (23503) into a friendly
 * 409 so the UI shows "clear the outstanding work first" instead of a raw
 * constraint dump like:
 *   update or delete on table "agents" violates foreign key constraint
 *   "reconciliations_agent_id_fkey" on table "reconciliations"
 *
 * Returns null for any other error so callers can fall through to a 500.
 *
 * @param noun what the user tried to delete ("agent", "employee", …)
 * @param hint optional alternative to suggest ("set it to Inactive")
 */
export function fkConflictResponse(
  error: { code?: string; message?: string } | null | undefined,
  noun: string,
  hint?: string
): NextResponse | null {
  const msg = error?.message ?? "";
  const isFkViolation =
    error?.code === "23503" || /foreign key constraint/i.test(msg);
  if (!isFkViolation) return null;

  // The PG message names the blocking table — surface it so the user knows
  // which outstanding work to clear.
  const table = /on table "(\w+)"/.exec(msg)?.[1];
  const linked = table
    ? `outstanding ${table.replace(/_/g, " ")} records`
    : "outstanding linked records";

  return NextResponse.json(
    {
      error:
        `Can't delete this ${noun} — it still has ${linked}. ` +
        `Clear the outstanding work first${hint ? `, or ${hint}` : ""}, then try again.`,
      code: "has_linked_records",
    },
    { status: 409 }
  );
}
