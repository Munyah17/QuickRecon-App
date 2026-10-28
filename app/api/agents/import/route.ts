import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_ROWS = 500;

interface RowOutcome {
  row: number;
  name: string;
  email: string;
  agentId?: string;
  ok: boolean;
  error?: string;
  /** Number of external-ID aliases stored for the agent. */
  ids?: number;
}

/** Pick the first present header (case-insensitive) from a parsed row. */
function pick(row: Record<string, unknown>, ...names: string[]): string {
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (k.trim().toLowerCase() === n.toLowerCase()) {
        const v = row[k];
        return v == null ? "" : String(v).trim();
      }
    }
  }
  return "";
}

function parseModules(raw: string): string[] {
  const s = raw.toLowerCase();
  const mods: string[] = [];
  if (!s || s === "both" || s === "all") return ["enpassent", "econet-moovah"];
  if (s.includes("enp")) mods.push("enpassent");
  if (s.includes("econet") || s.includes("moovah") || s.includes("eco")) {
    mods.push("econet-moovah");
  }
  return mods.length ? mods : ["enpassent"];
}

const STATUS_MAP: Record<string, string> = {
  active: "active",
  suspended: "suspended",
  inactive: "inactive",
  pending: "pending",
};

/**
 * Optional columns holding source-system identifiers. Each non-empty value is
 * stored in agent_external_ids so the reconciliation engine can match
 * transaction rows that carry these codes (Agent ID / ZINARA account etc.).
 * A cell may hold several codes separated by ";" or ",".
 */
const EXTERNAL_ID_COLUMNS: { scheme: string; headers: string[] }[] = [
  // "ZINARA" alone covers the RECON tab's code column (" ZINARA " → trimmed).
  { scheme: "zinara_user", headers: ["Zinara User", "ZINARA User", "ZINARA", "Zinara ID", "ZINARA Account", "ZINARA Account ID"] },
  { scheme: "nmb", headers: ["NMB", "NMB ZWG", "NMB ZiG"] },
  { scheme: "nmb_usd", headers: ["NMB USD", "NMB US$"] },
  { scheme: "cbz", headers: ["CBZ", "CBZ Account"] },
  { scheme: "nbs", headers: ["NBS", "NBS Account"] },
  { scheme: "fbc", headers: ["FBC", "FBC Account"] },
  { scheme: "enpassent_user_id", headers: ["Enpassent ID", "Enpassent User ID", "EP ID"] },
  { scheme: "econet_id", headers: ["Econet ID", "EcoCash ID", "MSISDN"] },
  // Per-bank POS IDs — each bank issues its own POS device & statement, so
  // POS columns map onto dedicated <bank>_pos schemes.
  { scheme: "nmb_pos", headers: ["NMB POS", "NMB POS ID", "NMB Terminal"] },
  { scheme: "cbz_pos", headers: ["CBZ POS", "CBZ POS ID", "CBZ Terminal"] },
  { scheme: "nbs_pos", headers: ["NBS POS", "NBS POS ID", "NBS Terminal"] },
  { scheme: "fbc_pos", headers: ["FBC POS", "FBC POS ID", "FBC Terminal"] },
  { scheme: "steward_pos", headers: ["Steward POS", "Steward POS ID", "Steward Terminal"] },
];

/** Split a multi-code cell into trimmed, non-empty values. */
function splitCodes(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * POST /api/agents/import
 * Bulk-create agents from an .xlsx/.csv upload. Expected columns (header row,
 * case-insensitive): Full Name* | Email | Phone | Province | Location |
 * National ID | IceCash ID | Modules | Status — plus optional external-ID
 * columns (Zinara User, NMB, NMB USD, CBZ, NBS, FBC, Enpassent ID, Econet ID,
 * and per-bank <BANK> POS columns) saved to agent_external_ids for
 * transaction matching.
 * Each row gets an agents row plus its agent_modules grants — no login is
 * provisioned (agents receive consolidated reconciliations on their contact
 * channels). Per-row outcomes are returned; one bad row never aborts the batch.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can import agents" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 413 });
  }

  const sb = await createServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let rows: Record<string, unknown>[];
  try {
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  } catch {
    return NextResponse.json({ error: "Could not parse file — upload .xlsx or .csv" }, { status: 422 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found in the first worksheet" }, { status: 422 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 413 });
  }

  // Sequential AGT ids — track the counter locally so concurrent rows don't
  // collide, and bump+retry once on a duplicate from a racing create.
  const { count } = await sb.from("agents").select("id", { count: "exact", head: true });
  let seq = count ?? 0;

  const outcomes: RowOutcome[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = pick(r, "Full Name", "Name", "Agent Name", "FullName", "Agent");
    const openingPosition = pick(r, "Balance B/d", "Opening Position", "Opening Balance", "Balance Brought Forward");
    const email = pick(r, "Email", "Email Address", "E-mail").toLowerCase();
    const phone = pick(r, "Phone", "Phone Number", "Mobile", "Contact", "Tel");
    const province = pick(r, "Province", "Region", "State");
    const location = pick(r, "Location", "Town", "City", "Area");
    const nationalId = pick(r, "National ID", "NationalID", "ID Number", "ID");
    const icecashId = pick(r, "IceCash ID", "IceCash", "IceCashID");
    const modules = parseModules(pick(r, "Modules", "Module", "Module Access"));
    const statusRaw = pick(r, "Status").toLowerCase();
    const status = STATUS_MAP[statusRaw] ?? "pending";

    // External IDs — dedupe (scheme, value) within the row. Zinara cells look
    // like "ZW019BJJ - KEITH HOMODZA": index the bare code as well so source
    // files that carry only "ZW019BJJ" still resolve to this agent.
    const aliasRows: { scheme: string; value: string }[] = [];
    const aliasSeen = new Set<string>();
    for (const { scheme, headers } of EXTERNAL_ID_COLUMNS) {
      for (const code of splitCodes(pick(r, ...headers))) {
        const variants = [code];
        const dash = code.indexOf(" - ");
        if (dash > 0) variants.push(code.slice(0, dash).trim());
        for (const v of variants) {
          const key = `${scheme}|${v.toUpperCase()}`;
          if (!aliasSeen.has(key)) {
            aliasSeen.add(key);
            aliasRows.push({ scheme, value: v });
          }
        }
      }
    }

    const base: RowOutcome = { row: i + 2, name: fullName, email, ok: false };
    if (!fullName) {
      outcomes.push({ ...base, error: "Full Name is required" });
      continue;
    }

    // No login is provisioned — agents receive consolidated reconciliations
    // on their contact channels, so a bare agents row is the whole account.
    try {
      let agentId = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        seq += 1;
        agentId = `AGT-${String(seq).padStart(6, "0")}`;
        const openingNum = Number(String(openingPosition).replace(/[^0-9.\-]/g, ""));
        const { error: agentError } = await sb.from("agents").insert({
          id: agentId,
          user_id: null,
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          province: province || location || null,
          location: location || null,
          national_id: nationalId || null,
          icecash_id: icecashId || null,
          opening_position: openingPosition && Number.isFinite(openingNum) ? openingNum : 0,
          status,
          kyc_status: "pending",
        });
        if (!agentError) break;
        if (agentError.code === "23505" && attempt < 2) continue; // id raced — bump and retry
        throw new Error(agentError.message);
      }
      await sb.from("agent_modules").insert(
        modules.map((m) => ({ agent_id: agentId, module: m }))
      );
      let ids = 0;
      if (aliasRows.length) {
        // ignoreDuplicates: a code already claimed by another agent stays put
        // rather than being silently re-pointed at the new row — unless the
        // importer is a super admin, who may legitimately reassign codes while
        // ZINARA re-issues replacements.
        const { data: inserted } = await sb
          .from("agent_external_ids")
          .upsert(
            aliasRows.map((a) => ({ agent_id: agentId, ...a })),
            {
              onConflict: "scheme,value",
              ignoreDuplicates: session.user.role !== "super_admin",
            }
          )
          .select("id");
        ids = inserted?.length ?? 0;
      }
      outcomes.push({ ...base, ok: true, agentId, ids: ids || undefined });
    } catch (e) {
      outcomes.push({ ...base, error: e instanceof Error ? e.message : "create failed" });
    }
  }

  const imported = outcomes.filter((o) => o.ok);
  return NextResponse.json({
    total: rows.length,
    created: imported.length,
    failed: outcomes.length - imported.length,
    outcomes,
  });
}
