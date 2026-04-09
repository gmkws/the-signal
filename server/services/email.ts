import nodemailer from "nodemailer";
import { ENV } from "../_core/env";

/**
 * Email service for The Signal.
 *
 * Configured for Microsoft Office 365 / Outlook SMTP:
 *   SMTP_HOST       — SMTP server hostname (smtp.office365.com)
 *   SMTP_PORT       — SMTP port (587 for STARTTLS — Office 365 default)
 *   SMTP_SECURE     — "true" for implicit TLS on port 465, omit/empty for STARTTLS on 587
 *   SMTP_USER       — Office 365 email address (e.g. you@yourdomain.com)
 *   SMTP_PASS       — Office 365 password or app password
 *   SMTP_FROM       — From address (default: SMTP_USER) — must match a verified sender in O365
 *   ADMIN_EMAIL     — Where to send admin notifications (default: SMTP_USER)
 *
 * All credentials are read from the centralized ENV object (server/_core/env.ts).
 * If SMTP_HOST is not set, email sending is skipped and a console log is
 * emitted instead — the app continues to function normally.
 */

function getTransporter() {
  const host = ENV.smtpHost;
  if (!host) return null;

  const port = parseInt(ENV.smtpPort || "587", 10);
  const secure = ENV.smtpSecure === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: ENV.smtpUser,
      pass: ENV.smtpPass,
    },
    // Office 365 requires STARTTLS on port 587; this ensures the TLS
    // upgrade negotiates correctly even on strict environments.
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: true,
    },
  });
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email. Returns true on success, false if SMTP is not configured or
 * sending fails. Never throws — callers should handle the false case gracefully.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(
      `[Email] SMTP not configured — would have sent email to ${payload.to}: "${payload.subject}"`
    );
    return false;
  }

  const from = ENV.smtpFrom || ENV.smtpUser || "noreply@thesignal.app";

  try {
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? `<pre style="font-family:sans-serif">${payload.text}</pre>`,
    });
    console.log(`[Email] Sent to ${payload.to}: "${payload.subject}" (messageId: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send to ${payload.to}: ${error.message}`);
    return false;
  }
}

/**
 * Send an admin notification email.
 * Uses ADMIN_EMAIL env var, falls back to SMTP_USER.
 */
export async function sendAdminNotification(title: string, content: string): Promise<boolean> {
  const adminEmail = ENV.adminEmail || ENV.smtpUser;

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
