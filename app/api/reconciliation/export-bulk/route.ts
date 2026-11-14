import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { documentsToWorkbook, reconDocFromRow } from "@/lib/reconciliation/document";

export const runtime = "nodejs";

/** ZIP-friendly organisation label for a module code. */
function orgLabel(module: string): string {
  if (module === "econet-moovah") return "Moovah";
  if (module === "enpassent") return "Enpassent";
  return "QuickRecon";
}

/** "2026-10" -> "October-2026". */
function monthYear(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (!y || !m || m < 1 || m > 12) return period;
  return `${months[m - 1]}-${y}`;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

interface ExportItem {
  agentId: string;
  batchId: string;
  period: string;
  module: string;
}

/**
 * Bulk-export prepared reconciliation documents as a single ZIP.
 *
 * Body (POST):
 *   { batchIds: string[], agentIds?: string[], currency?: "USD"|"ZWG",
 *     items?: ExportItem[] }
 *
 * - `items` (optional) pins the export to exact agent+batch+period+module
 *   combos — used for "export selected".
 * - Without `items`, every document in `batchIds` (optionally narrowed by
 *   `agentIds` / `currency`) is exported — used for "export all".
 *
 * One .xlsx workbook is produced per agent+module+period (USD + ZiG combined),
 * matching the single-document download. The ZIP is named
 * `{Organisation}-{Month}-{Year}.zip`.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Super admins and admins only.
  if (session.user.role !== "super_admin" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    batchIds?: string[];
    agentIds?: string[];
    currency?: string;
    items?: ExportItem[];
  };

  const items = Array.isArray(body.items) ? body.items : null;
  let batchIds = Array.isArray(body.batchIds) ? body.batchIds.filter(Boolean) : [];
  const agentIds = Array.isArray(body.agentIds) ? body.agentIds.filter(Boolean) : [];
  const currency = body.currency === "USD" || body.currency === "ZWG" ? body.currency : null;

  // Derive batch ids from items when the caller only sent a selection.
  if (items?.length) {
    const fromItems = items.map((i) => i.batchId).filter(Boolean);
    batchIds = [...new Set([...batchIds, ...fromItems])];
  }
  batchIds = [...new Set(batchIds)];

  if (batchIds.length === 0) {
    return NextResponse.json({ error: "batchIds required" }, { status: 400 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  // Fetch every document row in the requested batches (heavy JSONB included —
  // needed to render the workbooks). Bounded by batch_id so it stays scoped to
  // one monthly run per module.
  let q = sb.from("reconciliation_documents").select("*").in("batch_id", batchIds);
  if (currency) q = q.eq("currency", currency);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "No documents found" }, { status: 404 });
  }

  // Narrow to the requested selection.
  let rows = data as Record<string, unknown>[];
  if (items?.length) {
    const wanted = new Set(
      items.map((i) => `${i.agentId}|${i.batchId}|${i.period}|${i.module}`)
    );
    rows = rows.filter((r) =>
      wanted.has(`${r.agent_id}|${r.batch_id}|${r.period}|${r.module}`)
    );
  } else if (agentIds.length) {
    const wantedAgents = new Set(agentIds);
    rows = rows.filter((r) => wantedAgents.has(r.agent_id as string));
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No documents matched the selection" }, { status: 404 });
  }

  // Group by agent+module+period+batch — each group becomes one workbook with
  // its USD + ZiG currency variants combined (same as the single download).
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const key = `${r.agent_id}|${r.module}|${r.period}|${r.batch_id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let period = "";
  let moduleCode = "";

  for (const groupRows of groups.values()) {
    const docs = groupRows.map(reconDocFromRow);
    const primary = docs.find((d) => d.currency === "ZWG") ?? docs[0];
    period = primary.period || period;
    moduleCode = primary.module || moduleCode;
    try {
      const xlsx = await documentsToWorkbook(docs);
      const base = safeName(
        `${primary.agentName}-${moduleNameShort(primary.module)}-${primary.period}`
      );
      let fname = `${base}.xlsx`;
      let n = 2;
      while (usedNames.has(fname)) fname = `${base}-${n++}.xlsx`;
      usedNames.add(fname);
      zip.file(fname, xlsx);
    } catch (e) {
      console.error("export-bulk workbook failed:", e);
      // Skip the failing agent rather than aborting the whole export.
    }
  }

  if (usedNames.size === 0) {
    return NextResponse.json({ error: "Failed to generate any workbooks" }, { status: 500 });
  }

  // ZIP name: {Organisation}-{Month}-{Year}.zip — e.g. Moovah-October-2026.zip
  const org = orgLabel(moduleCode);
  const my = period ? monthYear(period) : "export";
  const zipName = safeName(`${org}-${my}`) + ".zip";

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "X-Document-Count": String(usedNames.size),
    },
  });
}

function moduleNameShort(code: string): string {
  if (code === "econet-moovah") return "Moovah";
  if (code === "enpassent") return "Enpassent";
  return safeName(code || "module");
}
