/**
 * Stripe Integration Service
 * Handles checkout sessions, subscription management, and webhook processing.
 * Gracefully degrades when STRIPE_SECRET_KEY is not configured.
 */
import Stripe from "stripe";
import * as db from "../db";

// ── Stripe Client ─────────────────────────────────────────────────────────
let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not configured — Stripe features disabled");
    return null;
  }
  stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as any });
  console.log("[Stripe] Initialized successfully");
  return stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ── Price IDs ─────────────────────────────────────────────────────────────
// These should be set as environment variables pointing to Stripe Price IDs.
// STRIPE_PRICE_MANAGED = price_xxx (Managed tier monthly)
// STRIPE_PRICE_PREMIUM = price_xxx (Premium tier monthly)
function getPriceId(tier: "managed" | "premium"): string | null {
  if (tier === "managed") return process.env.STRIPE_PRICE_MANAGED || null;
  if (tier === "premium") return process.env.STRIPE_PRICE_PREMIUM || null;
  return null;
}

// ── Checkout Session ──────────────────────────────────────────────────────
export async function createCheckoutSession(params: {
  userOpenId: string;
  userEmail: string;
  tier: "managed" | "premium";
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const s = getStripe();
  if (!s) return { error: "Stripe is not configured. Contact admin for manual setup." };

  const priceId = getPriceId(params.tier);
  if (!priceId) return { error: `No Stripe price configured for ${params.tier} tier. Contact admin.` };

  try {
    // Find or create Stripe customer
    const user = await db.getUserByOpenId(params.userOpenId);
    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await s.customers.create({
        email: params.userEmail,
        metadata: { openId: params.userOpenId, tier: params.tier },
      });
      customerId = customer.id;
      await db.updateUserStripeInfo(params.userOpenId, { stripeCustomerId: customerId });
    }

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { openId: params.userOpenId, tier: params.tier },
    });

    return { url: session.url! };
  } catch (err: any) {
    console.error("[Stripe] Checkout session creation failed:", err.message);
    return { error: err.message };
  }
}

// ── Webhook Processing ────────────────────────────────────────────────────
export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ received: boolean; error?: string }> {
  const s = getStripe();
  if (!s) return { received: false, error: "Stripe not configured" };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    return { received: false, error: "Webhook secret not configured" };
  }

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe] Webhook signature verification failed:", err.message);
    return { received: false, error: "Invalid signature" };
  }

  console.log(`[Stripe] Webhook event: ${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const openId = session.metadata?.openId;
      if (openId) {
        await db.updateUserStripeInfo(openId, {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          stripeSubscriptionStatus: "active",
        });
        console.log(`[Stripe] Subscription activated for user ${openId}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      // Find user by stripe customer ID
      const users = await db.getAllUsers();
      const user = users.find(u => u.stripeCustomerId === customerId);
      if (user) {
        await db.updateUserStripeInfo(user.openId, {
          stripeSubscriptionStatus: subscription.status,
        });
        console.log(`[Stripe] Subscription updated for user ${user.openId}: ${subscription.status}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const users = await db.getAllUsers();
      const user = users.find(u => u.stripeCustomerId === customerId);
      if (user) {
        await db.updateUserStripeInfo(user.openId, {
          stripeSubscriptionStatus: "canceled",
          stripeSubscriptionId: null as any,
        });
        console.log(`[Stripe] Subscription canceled for user ${user.openId}`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const users = await db.getAllUsers();
      const user = users.find(u => u.stripeCustomerId === customerId);
      if (user) {
        await db.updateUserStripeInfo(user.openId, {
          stripeSubscriptionStatus: "past_due",
        });
        console.log(`[Stripe] Payment failed for user ${user.openId}`);
      }
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  return { received: true };
}

// ── Customer Portal ───────────────────────────────────────────────────────
export async function createCustomerPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const s = getStripe();
  if (!s) return { error: "Stripe is not configured" };

  try {
    const session = await s.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  } catch (err: any) {
    console.error("[Stripe] Portal session creation failed:", err.message);
    return { error: err.message };
  }
}
