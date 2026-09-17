import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import type { TaskMilestone } from "@/types";

export const runtime = "nodejs";

const AFROSOFT_API_KEY = process.env.AFROSOFT_API_KEY || "";
const AFROSOFT_API_URL =
  process.env.AFROSOFT_API_URL || "https://api.afrosoft.co.zw/sms/v1/send";

async function sendSms(phone: string, message: string) {
  if (!AFROSOFT_API_KEY || !phone) return false;
  try {
    const res = await fetch(AFROSOFT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AFROSOFT_API_KEY}`,
      },
      body: JSON.stringify({
        recipients: [phone.replace(/\s/g, "")],
        message,
        sender_id: "QuickRecon",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Notify all super_admin/admin profiles in-app (service client bypasses the
 * owner-only notifications RLS). */
async function notifyAdmins(
  service: NonNullable<Awaited<ReturnType<typeof createServiceClient>>>,
  title: string,
  body: string
) {
  const { data: admins } = await service
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "admin"]);
  if (!admins?.length) return;
  await service.from("notifications").insert(
    admins.map((a: { id: string }) => ({
      user_id: a.id,
      kind: "task",
      title,
      body,
    }))
  );
}

/**
 * PATCH /api/tasks/[id]
 * Body: { milestoneId?, status? }
 *  - milestoneId: toggles that milestone done/undone (assignee or company).
 *  - status "completed": marks the task complete → SMS + WhatsApp to assignee.
 * Admin portal notifications fire on each milestone completion and on task
 * completion.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { milestoneId, status } = body ?? {};
  if (!milestoneId && !status) {
    return NextResponse.json(
      { error: "Provide milestoneId or status" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // RLS on tasks limits this read to company roles + the assignee.
  const { data: task, error: readErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const company = isCompanyRole(session.user.role);
  const isAssignee =
    (task.assignee_type === "agent" && task.assignee_id === session.user.agentId) ||
    (task.assignee_type === "staff" && task.assignee_id === session.user.id);
  if (!company && !isAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = await createServiceClient();
  const milestones: TaskMilestone[] = Array.isArray(task.milestones)
    ? task.milestones
    : [];
  const patch: Record<string, unknown> = {};
  let milestoneJustDone: TaskMilestone | null = null;

  if (milestoneId) {
    const idx = milestones.findIndex((m) => m.id === milestoneId);
    if (idx === -1) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    const nowDone = !milestones[idx].done;
    milestones[idx] = {
      ...milestones[idx],
      done: nowDone,
      doneAt: nowDone ? new Date().toISOString() : undefined,
    };
    if (nowDone) milestoneJustDone = milestones[idx];
    patch.milestones = milestones;
    // Any progress moves the task to in_progress.
    if (task.status === "pending" && milestones.some((m) => m.done)) {
      patch.status = "in_progress";
    }
    // All milestones done → auto-complete.
    if (milestones.length > 0 && milestones.every((m) => m.done)) {
      patch.status = "completed";
      patch.completed_at = new Date().toISOString();
    }
  }

  if (status === "completed") {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  } else if (status === "in_progress" || status === "pending") {
    patch.status = status;
    patch.completed_at = null;
  }

  const { data: updated, error: updErr } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // --- Notifications -------------------------------------------------------
  const actorName = session.user.fullName;
  if (service && milestoneJustDone) {
    await notifyAdmins(
      service,
      "Milestone completed",
      `${task.assignee_name} completed "${milestoneJustDone.title}" on task "${task.title}".`
    );
  }

  const justCompleted =
    patch.status === "completed" && task.status !== "completed";
  if (justCompleted) {
    // SMS + WhatsApp to the assignee — only for completed tasks.
    const phone = (task.assignee_phone ?? "").replace(/\s/g, "");
    if (phone) {
      const wa = getWhatsAppProvider();
      await wa.sendText(
        phone,
        `Task completed: "${task.title}". Well done — all milestones are done.`
      );
      await sendSms(phone, `QuickRecon: Task "${task.title}" marked completed.`);
    }
    if (service) {
      await notifyAdmins(
        service,
        "Task completed",
        `"${task.title}" assigned to ${task.assignee_name} is now complete${actorName ? ` (marked by ${actorName})` : ""}.`
      );
    }
  }

  return NextResponse.json({ task: updated });
}
