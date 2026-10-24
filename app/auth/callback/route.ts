import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : "/app/dashboard";
  if (code) {
    try {
      const sb = await createClient();
      if (sb) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // Do not expose auth codes or upstream response details in the URL.
    }
  }
  return NextResponse.redirect(new URL("/login?authError=expired", request.url));
}
