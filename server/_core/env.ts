export const ENV = {
  appId: process.env.VITE_APP_ID ?? "the-signal",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Stripe (optional — gracefully degrades when not set)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Email / SMTP (optional — gracefully degrades when not set)
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpUser: process.env.SMTP_USER ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
};
