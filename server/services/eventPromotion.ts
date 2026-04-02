/**
 * Event Promotion Sequence Generator
 *
 * Generates a series of AI-powered promotional posts for an event,
 * scheduled at configurable lead times before each event occurrence.
 */

import { invokeLLM } from "../_core/llm";
import type { Event, Brand } from "../../drizzle/schema";
import type { PromoType } from "../../shared/types";

// ── Occurrence Calculator ──────────────────────────────────────────────────

/**
 * Calculate all future occurrences of an event within a look-ahead window.
 * For one-time events, returns just the single occurrence.
 * For recurring events, returns all occurrences up to recurrenceEndDate or 90 days.
 */
export function getEventOccurrences(event: Event, lookAheadDays = 90): Date[] {
  const now = new Date();
  const occurrences: Date[] = [];
  const eventDate = new Date(event.eventDate);

  if (!event.isRecurring) {
    // One-time event — only include if it's in the future
    if (eventDate > now) {
      occurrences.push(eventDate);
    }
    return occurrences;
  }

  // Recurring event — calculate occurrences
  const maxDate = event.recurrenceEndDate
    ? new Date(event.recurrenceEndDate)
    : new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  let current = new Date(eventDate);

  // If the first occurrence is in the past, advance to the next future one
  while (current <= now) {
    current = advanceByPattern(current, event.recurrencePattern ?? "weekly");
  }

  // Collect all future occurrences within the window
  while (current <= maxDate) {
    occurrences.push(new Date(current));
    current = advanceByPattern(current, event.recurrencePattern ?? "weekly");
  }

  return occurrences;
}

function advanceByPattern(date: Date, pattern: string): Date {
  const next = new Date(date);
  switch (pattern) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

// ── Promo Schedule Builder ─────────────────────────────────────────────────

export interface PromoSlot {
  promoType: PromoType;
  eventOccurrenceDate: Date;
  scheduledDate: Date;
  leadDays: number; // 0 = day of, negative = post-event (recap)
}

/**
 * Build the full promotion schedule for all occurrences of an event.
 * promoLeadDays: e.g. [3, 1, 0] means teaser 3 days before, reminder 1 day before, day-of post
 * includeRecap: adds a post 1 day after the event
 */
export function buildPromoSchedule(event: Event): PromoSlot[] {
  const occurrences = getEventOccurrences(event);
  const leadDays = event.promoLeadDays ?? [0]; // default: day-of only
  const slots: PromoSlot[] = [];

  for (const occurrence of occurrences) {
    // Sort lead days descending (furthest first = teaser, then reminder, then day-of)
    const sortedLeads = [...leadDays].sort((a, b) => b - a);

    sortedLeads.forEach((days, index) => {
      const scheduledDate = new Date(occurrence);
      scheduledDate.setDate(scheduledDate.getDate() - days);

      let promoType: PromoType;
      if (days === 0) {
        promoType = "day_of";
      } else if (index === 0) {
        promoType = "teaser"; // Furthest out = teaser
      } else {
        promoType = "reminder"; // Closer = reminder
      }

      slots.push({
        promoType,
        eventOccurrenceDate: occurrence,
        scheduledDate,
        leadDays: days,
      });
    });

    // Add recap post if enabled (1 day after)
    if (event.includeRecap) {
      const recapDate = new Date(occurrence);
      recapDate.setDate(recapDate.getDate() + 1);
      slots.push({
        promoType: "recap",
        eventOccurrenceDate: occurrence,
        scheduledDate: recapDate,
        leadDays: -1,
      });
    }
  }

  return slots;
}

// ── AI Content Generator ───────────────────────────────────────────────────

export interface PromoPostContent {
  content: string;
  suggestedImagePrompt: string;
  contentType: string;
}

const PROMO_TYPE_INSTRUCTIONS: Record<PromoType, string> = {
  teaser: `This is an EARLY TEASER / ANNOUNCEMENT post. Create excitement and anticipation.
    - Announce the event is coming up
    - Build curiosity and excitement
    - Include the event name, date, and location
    - End with a clear CTA (get tickets, save the date, mark your calendar)
    - Keep it punchy and exciting — this is the first touch`,

  reminder: `This is a REMINDER / HYPE post (1-2 days before). Urgency is key.
    - Remind followers the event is happening very soon
    - Create FOMO (fear of missing out)
    - Reiterate key details: date, time, location
    - Include ticket/booking link if available
    - Use urgency language: "Tomorrow night", "This weekend", "Don't miss it"`,

  day_of: `This is the DAY-OF FINAL PUSH post. Maximum energy.
    - Today is the day — create maximum excitement
    - Short, punchy, high energy
    - Key details: time, location
    - Strong CTA: "See you tonight", "Doors open at [time]", "We're ready — are you?"
    - This should feel like the final call`,

  recap: `This is a POST-EVENT RECAP / THANK YOU post.
    - Thank everyone who attended
    - Celebrate the success of the event
    - Tease the next occurrence if it's recurring
    - Warm, grateful tone
    - Invite people to follow for next event announcements`,
};

export async function generatePromoPostContent(
  event: Event,
  brand: Brand,
  promoType: PromoType,
  occurrenceDate: Date
): Promise<PromoPostContent> {
  const voiceSettings = brand.voiceSettings as any;
  const tone = voiceSettings?.tone ?? "Professional";
  const style = voiceSettings?.style ?? "Direct";
  const customInstructions = voiceSettings?.customInstructions ?? "";

  const eventDateStr = occurrenceDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const eventTimeStr = occurrenceDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const systemPrompt = `You are a social media content writer for ${brand.name}, a ${brand.industry ?? "local business"} based in ${brand.location ?? "Hillsboro, Oregon"}.

Brand voice: ${tone}, ${style}.
${customInstructions ? `Additional instructions: ${customInstructions}` : ""}

Write social media posts that are authentic, engaging, and match the brand's voice exactly.
Keep posts between 100-250 characters for Instagram/Facebook. Use line breaks for readability.
Do NOT use excessive hashtags — 2-4 relevant hashtags maximum.
Always write in first-person plural ("We", "Our", "Join us") unless the brand voice specifies otherwise.`;

  const eventDetails = `
Event: ${event.name}
Date: ${eventDateStr} at ${eventTimeStr}
Location: ${event.location ?? "TBD"}
Description: ${event.description ?? ""}
${event.ticketLink ? `Tickets/Booking: ${event.ticketLink}` : ""}
${event.isRecurring ? `This is a recurring ${event.recurrencePattern} event.` : "This is a one-time event."}
  `.trim();

  const userPrompt = `${PROMO_TYPE_INSTRUCTIONS[promoType]}

Event Details:
${eventDetails}

Write the social media post now. Return a JSON object with:
- "content": the post text (ready to publish, with line breaks and hashtags)
- "suggestedImagePrompt": a detailed prompt for generating a promotional image for this event`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "promo_post",
        strict: true,
        schema: {
          type: "object",
          properties: {
            content: { type: "string", description: "The social media post text" },
            suggestedImagePrompt: { type: "string", description: "Image generation prompt" },
          },
          required: ["content", "suggestedImagePrompt"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const raw = typeof rawContent === "string" ? rawContent : "{}";
  let parsed: { content: string; suggestedImagePrompt: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      content: `${event.name} — ${eventDateStr} at ${event.location ?? "our venue"}. See you there!`,
      suggestedImagePrompt: `Promotional image for ${event.name} event at ${event.location}`,
    };
  }

  const contentTypeMap: Record<PromoType, string> = {
    teaser: "event_teaser",
    reminder: "event_reminder",
    day_of: "event_day_of",
    recap: "event_recap",
  };

  return {
    content: parsed.content,
    suggestedImagePrompt: parsed.suggestedImagePrompt,
    contentType: contentTypeMap[promoType],
  };
}
