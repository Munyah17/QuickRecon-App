import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

const AFROSOFT_API_KEY = process.env.AFROSOFT_API_KEY || "";
const AFROSOFT_API_URL = process.env.AFROSOFT_API_URL || "https://api.afrosoft.co.zw/sms/v1/send";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipients, message, senderId, includeAgents } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    let phones: string[] = Array.isArray(recipients)
      ? recipients.map((p: unknown) => String(p))
      : [];

    // Resolve real agent phone numbers when the sender asked for all agents.
    if (includeAgents) {
      const sb = await createServiceClient();
      if (!sb) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }
      const { data } = await sb.from("agents").select("phone").not("phone", "is", null);
      phones = phones.concat((data ?? []).map((a: { phone: string | null }) => a.phone ?? ""));
    }

    phones = [...new Set(phones.map((p) => p.replace(/\s/g, "")).filter(Boolean))];
    if (phones.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    if (!AFROSOFT_API_KEY) {
      return NextResponse.json(
        { error: "SMS gateway not configured — set AFROSOFT_API_KEY in environment settings." },
        { status: 503 }
      );
    }

    const res = await fetch(AFROSOFT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AFROSOFT_API_KEY}`,
      },
      body: JSON.stringify({
        recipients: phones,
        message,
        sender_id: senderId || "QuickRecon",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message || "SMS send failed" }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      sent: phones.length,
      ...data,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
