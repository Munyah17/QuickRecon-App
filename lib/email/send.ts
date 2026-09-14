import "server-only";
import nodemailer from "nodemailer";

/**
 * Server-side email delivery. Secrets come from env vars only and this
 * module is marked server-only so it can never be bundled for the browser.
 */
export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
}

function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const tx = transport();
  if (!tx) return { ok: false, error: "SMTP not configured" };
  try {
    const info = await tx.sendMail({
      from: process.env.SMTP_FROM ?? "QuickRecon App <noreply@example.com>",
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

export const emailTemplates = {
  newReport: (agentName: string, period: string) => ({
    subject: `QuickRecon App — reconciliation report for ${period}`,
    text: `Dear ${agentName},\n\nYour reconciliation report for ${period} is ready in QuickRecon App.\n\nRegards,\nEnpassent Team`,
  }),
  reconciliationPublished: (agentName: string, period: string) => ({
    subject: `Reconciliation published — ${period}`,
    text: `Dear ${agentName},\n\nYour ${period} reconciliation has been approved and published.\n\nRegards,\nEnpassent Team`,
  }),
  assistantApproved: (name: string, agentName: string) => ({
    subject: "Your assistant account is active",
    text: `Hello ${name},\n\nYour assistant account linked to ${agentName} has been approved. You can now sign in to QuickRecon App.`,
  }),
};
