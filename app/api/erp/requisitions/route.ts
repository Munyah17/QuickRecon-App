import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel",
  "application/msword",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|txt|png|jpe?g|webp)$/i;
const MAX_BYTES = 25 * 1024 * 1024;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("erp_requisitions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requisitions: data ?? [] });
}

/** Multipart form: title, requestedBy, department?, amount?, description?, file? */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const requestedBy = String(form.get("requestedBy") ?? session.user.fullName).trim();
  const department = String(form.get("department") ?? "").trim() || null;
  const amountRaw = form.get("amount");
  const amount = amountRaw ? Number(amountRaw) : null;
  const description = String(form.get("description") ?? "").trim() || null;
  const file = form.get("file");

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const id = `REQ-${Date.now().toString(36).toUpperCase()}`;
  let fileName: string | null = null;
  let filePath: string | null = null;
  let fileType: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXT.test(file.name)) {
      return NextResponse.json(
        { error: "Unsupported file type — pdf, docx, xlsx, txt, png, jpeg, jpg or webp only" },
        { status: 400 }
      );
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    filePath = `${id}/${safeName}`;
    fileName = file.name;
    fileType = file.type || "application/octet-stream";

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("requisitions")
      .upload(filePath, buffer, { contentType: fileType, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("erp_requisitions")
    .insert({
      id,
      title,
      requested_by: requestedBy,
      department,
      amount,
      description,
      file_name: fileName,
      file_path: filePath,
      file_type: fileType,
      created_by: session.user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requisition: data }, { status: 201 });
}
