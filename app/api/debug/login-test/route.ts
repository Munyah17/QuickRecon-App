import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** TEMP diagnostic — replicates the login flow server-side. Remove after use. */
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  // Step 1: signInWithPassword (same as loginWithPassword)
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ step: "createClient", error: "null" });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ step: "signInWithPassword", error: error.message });

  // Step 2: profile select as that user (via service client to mimic what RLS sees)
  const sb = await createServiceClient();
  const { data: profile, error: profileErr } = await sb!
    .from("profiles")
    .select("id, full_name, email, role, status, agent_id, parent_agent_id")
    .eq("id", data.user.id)
    .single();
  if (profileErr) return NextResponse.json({ step: "profile", error: profileErr.message });

  return NextResponse.json({ ok: true, userId: data.user.id, profile });
}
