import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KINDS = new Set(["invoice", "quotation"]);

/** GET /api/erp/documents — list invoices & quotations (company staff). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await sb
    .from("erp_documents")
    .select("*")
    .order("doc_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

/** POST /api/erp/documents — create an invoice or quotation. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = await createServiceClient();
  if (!sb) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = String(b?.kind ?? "");
  const client = String(b?.client ?? "").trim();
  if (!KINDS.has(kind)) return NextResponse.json({ error: "Invalid document kind" }, { status: 400 });
  if (!client) return NextResponse.json({ error: "Client is required" }, { status: 400 });
  const lines = Array.isArray(b?.lines) ? (b.lines as unknown[]) : [];
  if (lines.length === 0) return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });

  // Generate the next sequential id per kind+year, e.g. INV-2026-006.
  const year = new Date().getFullYear();
  const prefix = kind === "invoice" ? "INV" : "QT";
  const { data: rows } = await sb.from("erp_documents").select("id").eq("kind", kind);
  const max = (rows ?? []).reduce((m, r) => {
    const n = parseInt(String(r.id).split("-").pop() ?? "", 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const id = `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;

  const { data, error } = await sb.from("erp_documents").insert({
    id,
    kind,
    client,
    client_contact: (b?.clientContact as string) || null,
    client_address: (b?.clientAddress as string) || null,
    client_email: (b?.clientEmail as string) || null,
    client_phone: (b?.clientPhone as string) || null,
    po_number: (b?.poNumber as string) || null,
    amount: Number(b?.amount) || 0,
    currency: (b?.currency as string) || "ZWG",
    doc_date: (b?.date as string) || new Date().toISOString().slice(0, 10),
    due_date: (b?.due as string) || null,
    valid_until: (b?.validUntil as string) || null,
    status: (b?.status as string) || "draft",
    vat_rate: b?.vatRate != null ? Number(b.vatRate) : null,
    discount_pct: b?.discountPct != null ? Number(b.discountPct) : null,
    amount_paid: Number(b?.amountPaid) || 0,
    notes: (b?.notes as string) || null,
    lines,
    created_by: session.user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
