import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Approve / reject a requisition, or fetch a signed download URL. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("erp_requisitions")
    .update({
      status,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requisition: data });
}

/** GET → short-lived signed URL for the attached file. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = await params;
  const { data: req } = await supabase
    .from("erp_requisitions")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!req?.file_path) {
    return NextResponse.json({ error: "No attachment" }, { status: 404 });
  }
  const { data, error } = await supabase.storage
    .from("requisitions")
    .createSignedUrl(req.file_path, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not sign file URL" }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
