import nodemailer from "nodemailer";
import dns from "dns";
import { ENV } from "../_core/env";

// Force Node.js DNS to resolve IPv4 first — Railway containers often lack
// IPv6 connectivity, but smtp.office365.com returns AAAA records first,
// causing ENETUNREACH errors.
dns.setDefaultResultOrder("ipv4first");

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

/**
 * Resolve the SMTP host to an IPv4 address. Railway containers often lack
 * IPv6 connectivity, but smtp.office365.com returns AAAA records first,
 * causing ENETUNREACH. By resolving to IPv4 upfront and passing the raw IP
 * to nodemailer, we bypass the issue entirely.
 */
async function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) {
        console.warn(`[Email] IPv4 DNS resolution failed for ${hostname}, using hostname as-is: ${err.message}`);
        resolve(hostname); // Fall back to hostname and let nodemailer try
      } else {
        console.log(`[Email] Resolved ${hostname} → ${address} (IPv4)`);
        resolve(address);
      }
    });
  });
}

async function createTransporter() {
  const host = ENV.smtpHost;
  if (!host) return null;

  const port = parseInt(ENV.smtpPort || "587", 10);
  const secure = ENV.smtpSecure === "true";

  // Resolve to IPv4 to avoid Railway IPv6 ENETUNREACH
  const resolvedHost = await resolveIPv4(host);

  return nodemailer.createTransport({
    host: resolvedHost,
    port,
    secure,                    // false for port 587 (STARTTLS), true for port 465 (implicit TLS)
    requireTLS: !secure,       // Force STARTTLS upgrade on port 587 (Office 365 requirement)
    auth: {
      user: ENV.smtpUser,
      pass: ENV.smtpPass,
    },
    tls: {
      minVersion: "TLSv1.2",  // Office 365 requires TLS 1.2+
      servername: host,        // Use original hostname for TLS certificate verification
    },
    connectionTimeout: 10000,  // 10s connection timeout
    greetingTimeout: 10000,    // 10s greeting timeout
    socketTimeout: 15000,      // 15s socket timeout
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
  const transporter = await createTransporter();

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
    console.error(`[Email] SMTP config: host=${ENV.smtpHost}, port=${ENV.smtpPort}, secure=${ENV.smtpSecure}, user=${ENV.smtpUser}`);
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
