import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isCompanyRole } from "@/lib/nav";

export const runtime = "nodejs";

/**
 * GET /api/communications — fetch sent communications history
 * Returns a summary of all sent messages for the current user
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const channel = searchParams.get("channel");

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let query = supabase
    .from("communications")
    .select(`
      id,
      message,
      channel,
      status,
      recipient_count,
      sent_at,
      scheduled_for,
      sent_by,
      profiles!communications_sent_by_fkey (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get summary stats
  const { data: stats, error: statsError } = await supabase
    .from("communications")
    .select("channel, status, recipient_count")
    .order("created_at", { ascending: false })
    .limit(1000);

  const summary = {
    total: stats?.length || 0,
    byChannel: {
      sms: stats?.filter((s) => s.channel === "sms").length || 0,
      email: stats?.filter((s) => s.channel === "email").length || 0,
      whatsapp: stats?.filter((s) => s.channel === "whatsapp").length || 0,
      in_app: stats?.filter((s) => s.channel === "in_app").length || 0,
    },
    byStatus: {
      sent: stats?.filter((s) => s.status === "sent").length || 0,
      failed: stats?.filter((s) => s.status === "failed").length || 0,
      scheduled: stats?.filter((s) => s.status === "scheduled").length || 0,
      pending: stats?.filter((s) => s.status === "pending").length || 0,
    },
    totalRecipients: stats?.reduce((sum, s) => sum + (s.recipient_count || 0), 0) || 0,
  };

  return NextResponse.json({
    communications: data,
    summary,
    pagination: {
      limit,
      offset,
      hasMore: (data?.length || 0) === limit,
    },
  });
}
