export const ENV = {
  appId: process.env.VITE_APP_ID ?? "the-signal",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // OpenAI (LLM + DALL-E image generation)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Legacy Manus Forge (deprecated — kept for reference)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Cloudflare R2 (image/file storage)
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "",
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? "",
  // Stripe (optional — gracefully degrades when not set)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Email via Resend (optional — gracefully degrades when not set)
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
};
