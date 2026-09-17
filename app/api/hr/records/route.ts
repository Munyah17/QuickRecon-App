import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TYPES = new Set([
  "welfare", "leave", "loan", "sick_note", "timecard", "banking", "kyc",
]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const type = request.nextUrl.searchParams.get("type");
  let q = supabase.from("hr_records").select("*").order("created_at", { ascending: false });
  if (type && TYPES.has(type)) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  const { type, staffId, staffName, payload, status } = body ?? {};
  if (!type || !TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid record type" }, { status: 400 });
  }
  if (!staffId || !staffName) {
    return NextResponse.json({ error: "staffId and staffName are required" }, { status: 400 });
  }

  const id = `HR-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("hr_records")
    .insert({
      id,
      type,
      staff_id: staffId,
      staff_name: staffName,
      payload: payload ?? {},
      status: status ?? "pending",
      created_by: session.user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data }, { status: 201 });
}
