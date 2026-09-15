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
      headers: {
        "X-Mailer": "QuickRecon App",
        "X-Priority": "3",
        "List-Unsubscribe": `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`,
      },
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/**
 * Wraps a body fragment in the branded QuickRecon email shell — navy header
 * band, content card, signature block and footer. Looks professional and
 * scores better with spam filters (balanced text/HTML, real signature).
 */
export function brandedEmail(bodyHtml: string, recipientName?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0f2b4c;border-radius:12px 12px 0 0;padding:18px 24px;">
      <span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:0.3px;">QuickRecon App</span>
      <span style="color:#9fb8d4;font-size:11px;float:right;padding-top:4px;">Reconciliation Report</span>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
      ${recipientName ? `<p style="font-size:13px;color:#374151;margin:0 0 14px;">Dear ${recipientName},</p>` : ""}
      ${bodyHtml}
    </div>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#374151;">
        Regards,<br><strong>Kareem</strong> — QuickRecon App<br>
        <span style="color:#6b7280;">Automated reconciliation reports</span>
      </p>
      <p style="margin:10px 0 0;font-size:10.5px;color:#9ca3af;line-height:1.5;">
        This message contains confidential reconciliation data intended only for the
        named recipient. If you received it in error, please delete it and notify
        the sender. &copy; Enpassent (Private) Limited — Harare, Zimbabwe.
      </p>
    </div>
  </div>
</body>
</html>`;
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
