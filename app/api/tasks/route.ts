import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isCompanyRole } from "@/lib/nav";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import type { TaskMilestone } from "@/types";

export const runtime = "nodejs";

/** Create a task and notify the assignee on WhatsApp (+ in-app for staff). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCompanyRole(session.user.role)) {
    return NextResponse.json({ error: "Only company staff can assign tasks" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const {
    title,
    description,
    priority = "normal",
    dueDate,
    assigneeType,
    assigneeId,
    shared = false,
    milestones = [],
  } = body ?? {};

  if (!title || !assigneeType || !assigneeId) {
    return NextResponse.json(
      { error: "title, assigneeType and assigneeId are required" },
      { status: 400 }
    );
  }
  if (!["agent", "staff"].includes(assigneeType)) {
    return NextResponse.json({ error: "assigneeType must be agent or staff" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  // Resolve the real assignee record for name + contact details.
  const service = await createServiceClient();
  const lookup = service ?? supabase;
  let assigneeName = "";
  let assigneePhone: string | null = null;
  let assigneeEmail: string | null = null;

  if (assigneeType === "agent") {
    const { data } = await lookup
      .from("agents")
      .select("id, full_name, phone, email")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    assigneeName = data.full_name;
    assigneePhone = data.phone;
    assigneeEmail = data.email;
  } else {
    const { data } = await lookup
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    assigneeName = data.full_name;
    assigneeEmail = data.email;
    const { data: contact } = await lookup
      .from("profiles")
      .select("phone")
      .eq("id", assigneeId)
      .maybeSingle();
    assigneePhone = (contact as { phone?: string } | null)?.phone ?? null;
  }

  const cleanMilestones: TaskMilestone[] = (
    Array.isArray(milestones) ? milestones : []
  )
    .map((m: { title?: string }, i: number) => ({
      id: `m${i + 1}`,
      title: String(m?.title ?? `Milestone ${i + 1}`).trim() || `Milestone ${i + 1}`,
      done: false,
    }))
    .slice(0, 20);

  const id = `TSK-${Date.now().toString(36).toUpperCase()}`;
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      id,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      priority,
      due_date: dueDate || null,
      assignee_type: assigneeType,
      assignee_id: assigneeId,
      assignee_name: assigneeName,
      assignee_phone: assigneePhone,
      assignee_email: assigneeEmail,
      shared: !!shared,
      milestones: cleanMilestones,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // WhatsApp notification to the assignee.
  let whatsappSent = false;
  if (assigneePhone) {
    const wa = getWhatsAppProvider();
    const res = await wa.sendText(
      assigneePhone.replace(/\s/g, ""),
      `New task assigned: "${task.title}"\nPriority: ${priority}\n${dueDate ? `Due: ${dueDate}\n` : ""}Open QuickRecon App → Task Management to view milestones.`
    );
    whatsappSent = res.ok;
  }

  // In-app notification for staff assignees (service client bypasses the
  // owner-only notifications RLS).
  if (service && assigneeType === "staff") {
    await service.from("notifications").insert({
      user_id: assigneeId,
      kind: "task",
      title: "New task assigned",
      body: `"${task.title}" was assigned to you by ${session.user.fullName}.`,
    });
  }

  return NextResponse.json({ task, whatsappSent }, { status: 201 });
}
