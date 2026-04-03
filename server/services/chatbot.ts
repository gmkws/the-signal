/**
 * DM Chatbot Lead Generation Service
 *
 * State machine: greeting → ask_name → ask_contact → ask_time → closing → complete
 *
 * Handles both Instagram DMs and Facebook Messenger.
 * Uses Meta Graph API to send reply messages.
 */

import {
  getConversation,
  upsertConversation,
  getChatbotFlow,
  createLead,
  DEFAULT_CHATBOT_FLOW,
  getAllBrands,
  getSocialAccountsByBrandId,
} from "../db";
import { notifyOwner } from "../_core/notification";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

// ── Meta Send-Message API ─────────────────────────────────────────────────

async function sendInstagramMessage(
  igAccountId: string,
  accessToken: string,
  recipientId: string,
  text: string
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/${igAccountId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: accessToken,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Instagram send message failed: ${JSON.stringify(err)}`);
  }
}

async function sendFacebookMessage(
  pageId: string,
  accessToken: string,
  recipientId: string,
  text: string
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: accessToken,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Facebook send message failed: ${JSON.stringify(err)}`);
  }
}

// ── Find Brand by Platform Account ───────────────────────────────────────

async function findBrandForAccount(
  platform: "instagram" | "facebook",
  accountId: string
): Promise<{ brandId: number; accessToken: string; platformAccountId: string } | null> {
  const brands = await getAllBrands();
  for (const brand of brands) {
    const accounts = await getSocialAccountsByBrandId(brand.id);
    for (const acct of accounts) {
      if (
        acct.platform === platform &&
        acct.isConnected &&
        (acct.platformAccountId === accountId ||
          (platform === "instagram" && (acct as any).instagramBusinessId === accountId) ||
          (platform === "facebook" && (acct as any).pageId === accountId))
      ) {
        return {
          brandId: brand.id,
          accessToken: acct.accessToken ?? "",
          platformAccountId: acct.platformAccountId,
        };
      }
    }
  }
  return null;
}

// ── Reply Helper ──────────────────────────────────────────────────────────

async function sendReply(
  platform: "instagram" | "facebook",
  accountInfo: { platformAccountId: string; accessToken: string },
  recipientId: string,
  text: string
): Promise<void> {
  if (platform === "instagram") {
    await sendInstagramMessage(accountInfo.platformAccountId, accountInfo.accessToken, recipientId, text);
  } else {
    await sendFacebookMessage(accountInfo.platformAccountId, accountInfo.accessToken, recipientId, text);
  }
}

// ── State Machine ─────────────────────────────────────────────────────────

export async function processDmMessage(
  platform: "instagram" | "facebook",
  recipientAccountId: string,
  senderId: string,
  messageText: string
): Promise<void> {
  // Find which brand owns this account
  const accountInfo = await findBrandForAccount(platform, recipientAccountId);
  if (!accountInfo) {
    // No brand connected to this account — ignore
    return;
  }

  const { brandId } = accountInfo;

  // Get or initialize conversation
  const existing = await getConversation(brandId, senderId, platform);
  const state = existing?.state ?? "greeting";
  const collected = (existing?.collectedData as Record<string, string>) ?? {};

  // Get chatbot flow config for this brand
  const flow = await getChatbotFlow(brandId);
  const messages = {
    greeting: flow?.greeting ?? DEFAULT_CHATBOT_FLOW.greeting,
    askName: flow?.askName ?? DEFAULT_CHATBOT_FLOW.askName,
    askContact: flow?.askContact ?? DEFAULT_CHATBOT_FLOW.askContact,
    askTime: flow?.askTime ?? DEFAULT_CHATBOT_FLOW.askTime,
    closingMessage: flow?.closingMessage ?? DEFAULT_CHATBOT_FLOW.closingMessage,
  };

  // Check if chatbot is active
  if (flow && !flow.isActive) return;

  // Handle opt-out keywords
  const lowerText = messageText.toLowerCase().trim();
  if (["stop", "unsubscribe", "quit", "cancel", "no thanks"].includes(lowerText)) {
    await upsertConversation({ brandId, senderId, platform, state: "opted_out", collectedData: collected });
    await sendReply(platform, accountInfo, senderId, "No problem! You won't receive any more automated messages from us. Feel free to reach out anytime.");
    return;
  }

  // Don't re-engage completed or opted-out conversations unless they send a new inquiry
  if (state === "complete" || state === "opted_out") {
    // Re-start if they send a new message
    await upsertConversation({ brandId, senderId, platform, state: "greeting", collectedData: {} });
    await sendReply(platform, accountInfo, senderId, messages.greeting);
    return;
  }

  let nextState = state;
  const updatedData = { ...collected };

  switch (state) {
    case "greeting":
      // They just messaged us — send greeting and move to ask_service
      updatedData.service = messageText; // Treat first message as service interest
      nextState = "ask_name";
      await sendReply(platform, accountInfo, senderId, messages.askName);
      break;

    case "ask_name":
      updatedData.name = messageText;
      nextState = "ask_contact";
      await sendReply(platform, accountInfo, senderId, messages.askContact);
      break;

    case "ask_contact":
      updatedData.contact = messageText;
      nextState = "ask_time";
      await sendReply(platform, accountInfo, senderId, messages.askTime);
      break;

    case "ask_time":
      updatedData.preferredTime = messageText;
      nextState = "complete";

      // Send closing message
      await sendReply(platform, accountInfo, senderId, messages.closingMessage);

      // Save lead to database
      const isEmail = /\S+@\S+\.\S+/.test(updatedData.contact ?? "");
      await createLead({
        brandId,
        platform,
        senderId,
        name: updatedData.name,
        email: isEmail ? updatedData.contact : undefined,
        phone: !isEmail ? updatedData.contact : undefined,
        serviceNeeded: updatedData.service,
        preferredTime: updatedData.preferredTime,
        status: "new",
        conversationId: `${platform}_${senderId}`,
      });

      // Notify owner
      await notifyOwner({
        title: `[The Signal] New Lead — Brand #${brandId}`,
        content: `New lead captured via ${platform} DM:\n\nName: ${updatedData.name ?? "Unknown"}\nService: ${updatedData.service ?? "Not specified"}\nContact: ${updatedData.contact ?? "Not provided"}\nPreferred Time: ${updatedData.preferredTime ?? "Not specified"}\n\nCheck the Leads dashboard for details.`,
      }).catch(() => {});

      break;

    default:
      // Unknown state — reset to greeting
      nextState = "greeting";
      await sendReply(platform, accountInfo, senderId, messages.greeting);
      break;
  }

  await upsertConversation({ brandId, senderId, platform, state: nextState, collectedData: updatedData });
}

// ── Webhook Event Parser ──────────────────────────────────────────────────

export interface WebhookDmEvent {
  platform: "instagram" | "facebook";
  recipientId: string;
  senderId: string;
  messageText: string;
  timestamp: number;
}

export function parseInstagramWebhook(body: any): WebhookDmEvent[] {
  const events: WebhookDmEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const messaging of entry.messaging ?? []) {
      if (messaging.message?.text && !messaging.message.is_echo) {
        events.push({
          platform: "instagram",
          recipientId: messaging.recipient?.id ?? entry.id,
          senderId: messaging.sender?.id,
          messageText: messaging.message.text,
          timestamp: messaging.timestamp ?? Date.now(),
        });
      }
    }
  }
  return events;
}

export function parseFacebookWebhook(body: any): WebhookDmEvent[] {
  const events: WebhookDmEvent[] = [];
  for (const entry of body.entry ?? []) {
    for (const messaging of entry.messaging ?? []) {
      if (messaging.message?.text && !messaging.message.is_echo) {
        events.push({
          platform: "facebook",
          recipientId: messaging.recipient?.id ?? entry.id,
          senderId: messaging.sender?.id,
          messageText: messaging.message.text,
          timestamp: messaging.timestamp ?? Date.now(),
        });
      }
    }
  }
  return events;
}
