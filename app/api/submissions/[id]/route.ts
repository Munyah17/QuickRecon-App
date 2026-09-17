import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REVIEW_STATUSES = ["under_review", "completed", "rejected"] as const;

/**
 * PATCH /api/submissions/[id]
 * Body: { status: "under_review" | "completed" | "rejected", reviewerComment? }
 * Company staff review agent submissions — approve (completed) or reject.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can review submissions" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { status, reviewerComment } = body ?? {};
  if (!REVIEW_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${REVIEW_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const patch: Record<string, unknown> = { status };
  if (reviewerComment !== undefined) {
    patch.reviewer_comment = reviewerComment ? String(reviewerComment).trim() : null;
  }

  const { data: updated, error } = await supabase
    .from("submissions")
    .update(patch)
    .eq("id", id)
    .select("id, agent_id, title, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  // In-app notification to the agent (service client bypasses owner-only RLS).
  const service = await createServiceClient();
  if (service && updated.agent_id) {
    const { data: agentProfile } = await service
      .from("profiles")
      .select("id")
      .eq("agent_id", updated.agent_id)
      .maybeSingle();
    if (agentProfile?.id) {
      await service.from("notifications").insert({
        user_id: agentProfile.id,
        kind: "submission",
        title: status === "completed" ? "Submission approved" : status === "rejected" ? "Submission rejected" : "Submission under review",
        body: `"${updated.title}" was ${status === "completed" ? "approved" : status} by ${session.user.fullName}.${reviewerComment ? ` Comment: ${reviewerComment}` : ""}`,
      });
    }
  }

  return NextResponse.json({ submission: updated });
}
