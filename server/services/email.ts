import { ENV } from "../_core/env";

/**
 * Email service for The Signal.
 *
 * Uses Resend (https://resend.com) HTTP API for transactional email.
 * This avoids SMTP port-blocking issues on Railway.
 *
 *   RESEND_API_KEY  — Resend API key (re_...)
 *   EMAIL_FROM      — From address (must be on a verified Resend domain)
 *   ADMIN_EMAIL     — Where to send admin notifications
 *
 * All credentials are read from the centralized ENV object (server/_core/env.ts).
 * If RESEND_API_KEY is not set, email sending is skipped and a console log is
 * emitted instead — the app continues to function normally.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email via Resend. Returns true on success, false if not configured
 * or sending fails. Never throws — callers should handle the false case gracefully.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!ENV.resendApiKey) {
    console.log(
      `[Email] Resend not configured — would have sent email to ${payload.to}: "${payload.subject}"`
    );
    return false;
  }

  const from = ENV.emailFrom || "noreply@notify.gmkwebsolutions.com";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<pre style="font-family:sans-serif">${payload.text}</pre>`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[Email] Sent to ${payload.to}: "${payload.subject}" (id: ${data.id})`);
      return true;
    }

    const errorBody = await response.text().catch(() => "");
    console.error(`[Email] Resend API error (${response.status}): ${errorBody}`);
    return false;
  } catch (error: any) {
    console.error(`[Email] Failed to send to ${payload.to}: ${error.message}`);
    return false;
  }
}

/**
 * Send an admin notification email.
 * Uses ADMIN_EMAIL env var.
 */
export async function sendAdminNotification(title: string, content: string): Promise<boolean> {
  const adminEmail = ENV.adminEmail;

  if (!adminEmail) {
    console.log(`[Email] No ADMIN_EMAIL configured — notification: "${title}"`);
    return false;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0d1117; color: #e6edf3; padding: 20px; border-radius: 8px;">
        <h2 style="margin: 0 0 16px; color: #00e5cc;">${escapeHtml(title)}</h2>
        <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(content)}</p>
        <hr style="border: none; border-top: 1px solid #30363d; margin: 20px 0;" />
        <p style="margin: 0; font-size: 12px; color: #8b949e;">
          This notification was sent by The Signal platform.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `[The Signal] ${title}`,
    text: `${title}\n\n${content}`,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
