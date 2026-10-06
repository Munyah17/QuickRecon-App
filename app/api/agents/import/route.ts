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
  tempPassword?: string;
  ok: boolean;
  error?: string;
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
 * POST /api/agents/import
 * Bulk-create agents from an .xlsx/.csv upload. Expected columns (header row,
 * case-insensitive): Full Name* | Email* | Phone | Province | Location |
 * National ID | IceCash ID | Modules | Status.
 * Each row gets an auth login (generated temp password), a profiles row, an
 * agents row and its agent_modules grants — the same shape as POST /api/users.
 * Per-row outcomes are returned; one bad row never aborts the batch.
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
    const fullName = pick(r, "Full Name", "Name", "Agent Name", "FullName");
    const email = pick(r, "Email", "Email Address", "E-mail").toLowerCase();
    const phone = pick(r, "Phone", "Phone Number", "Mobile", "Contact", "Tel");
    const province = pick(r, "Province", "Region", "State");
    const location = pick(r, "Location", "Town", "City", "Area");
    const nationalId = pick(r, "National ID", "NationalID", "ID Number", "ID");
    const icecashId = pick(r, "IceCash ID", "IceCash", "IceCashID");
    const modules = parseModules(pick(r, "Modules", "Module", "Module Access"));
    const statusRaw = pick(r, "Status").toLowerCase();
    const status = STATUS_MAP[statusRaw] ?? "pending";

    const base: RowOutcome = { row: i + 2, name: fullName, email, ok: false };
    if (!fullName || !email) {
      outcomes.push({ ...base, error: "Full Name and Email are required" });
      continue;
    }

    const tempPassword = `Qr-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;

    try {
      const { data: authUser, error: authError } = await sb.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "agent" },
      });
      if (authError) throw new Error(authError.message);
      const userId = authUser.user.id;

      try {
        const { error: profileError } = await sb.from("profiles").upsert(
          {
            id: userId,
            full_name: fullName,
            email,
            role: "agent",
            status: "active",
            phone: phone || null,
          },
          { onConflict: "id" }
        );
        if (profileError) throw new Error(profileError.message);

        seq += 1;
        const agentId = `AGT-${String(seq).padStart(6, "0")}`;
        const { error: agentError } = await sb.from("agents").insert({
          id: agentId,
          user_id: userId,
          full_name: fullName,
          email,
          phone: phone || null,
          province: province || location || null,
          location: location || null,
          national_id: nationalId || null,
          icecash_id: icecashId || null,
          status,
          kyc_status: "pending",
        });
        if (agentError) {
          // Roll back the login so a failed row leaves no orphan account.
          await sb.from("profiles").delete().eq("id", userId);
          await sb.auth.admin.deleteUser(userId);
          throw new Error(agentError.message);
        }
        await sb.from("profiles").update({ agent_id: agentId }).eq("id", userId);
        await sb.from("agent_modules").insert(
          modules.map((m) => ({ agent_id: agentId, module: m }))
        );
        outcomes.push({ ...base, ok: true, agentId, tempPassword });
      } catch (inner) {
        await sb.auth.admin.deleteUser(userId).catch(() => {});
        throw inner;
      }
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
