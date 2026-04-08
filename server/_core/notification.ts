import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { sendAdminNotification } from "../services/email";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl
    : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  // Try Manus Forge notification service first (available in Manus sandbox)
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${ENV.forgeApiKey}`,
          "content-type": "application/json",
          "connect-protocol-version": "1",
        },
        body: JSON.stringify({ title, content }),
      });

      if (response.ok) {
        return true;
      }

      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Forge service failed (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        } — falling back to email`
      );
    } catch (error) {
      console.warn("[Notification] Forge service error, falling back to email:", error);
    }
  }

  // Fall back to email notification (works on Railway and any SMTP-configured environment)
  const emailSent = await sendAdminNotification(title, content);
  if (emailSent) {
    return true;
  }

  // Both methods unavailable — log the notification so it's at least visible in Railway logs
  console.log(`[Notification] OWNER NOTIFICATION (no delivery channel configured):\nTitle: ${title}\nContent: ${content}`);
  return false;
}
