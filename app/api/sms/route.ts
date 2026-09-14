import { NextRequest, NextResponse } from "next/server";

const AFROSOFT_API_KEY = process.env.AFROSOFT_API_KEY || "";
const AFROSOFT_API_URL = process.env.AFROSOFT_API_URL || "https://api.afrosoft.co.zw/sms/v1/send";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, message, senderId } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    if (!AFROSOFT_API_KEY) {
      return NextResponse.json({
        success: true,
        simulated: true,
        sent: recipients.length,
        message: "SMS simulated (no API key configured)",
      });
    }

    const res = await fetch(AFROSOFT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AFROSOFT_API_KEY}`,
      },
      body: JSON.stringify({
        recipients: recipients.map((r: string) => r.replace(/\s/g, "")),
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
      sent: recipients.length,
      ...data,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
