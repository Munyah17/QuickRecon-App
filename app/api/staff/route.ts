import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/staff — company staff directory (confidential salary data). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await sb.from("staff").select("*").order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}

/** POST /api/staff — add an employee. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(b?.fullName ?? b?.full_name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Full name is required" }, { status: 400 });

  // Generate the next EMP-xxx id.
  const { data: rows } = await sb.from("staff").select("id");
  const max = (rows ?? []).reduce((m, r) => {
    const n = parseInt(String(r.id).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const id = `EMP-${String(max + 1).padStart(3, "0")}`;

  const { data, error } = await sb.from("staff").insert({
    id,
    full_name: name,
    job_title: (b?.jobTitle as string) || (b?.job_title as string) || null,
    department: (b?.department as string) || null,
    salary: Number(b?.salary) || 0,
    status: (b?.status as string) || "active",
    phone: (b?.phone as string) || null,
    email: (b?.email as string) || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data }, { status: 201 });
}
