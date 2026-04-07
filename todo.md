# The Signal - Project TODO

## Phase 1: Foundation
- [x] Dark navy/cyan theme setup in index.css
- [x] GMK logo CDN integration
- [x] Database schema (brands, posts, schedules, notifications, social_accounts)
- [x] Run db:push migrations

## Phase 2: Backend
- [x] Brand CRUD tRPC routers (admin)
- [x] Post CRUD tRPC routers (admin + client)
- [x] Content calendar query router
- [x] AI content generation router (LLM integration)
- [x] AI image generation router
- [x] Meta Graph API service (Facebook + Instagram OAuth)
- [x] Social account connection router
- [x] Notification system router
- [x] Analytics/insights router
- [x] Scheduling engine (auto-post toggle, queue management)
- [x] Client tier access control (Managed vs Premium)

## Phase 3: Frontend Layouts
- [x] Admin DashboardLayout with sidebar navigation
- [x] Client portal layout with tier-based navigation
- [x] App.tsx routing for admin and client routes
- [x] Auth guards for admin vs client roles (AdminGuard/ClientGuard components)

## Phase 4: Admin Dashboard Pages
- [x] Admin overview page (all brands summary)
- [x] Brand management page (create/edit/delete brands, up to 5)
- [x] Content calendar page (upcoming + past posts)
- [x] Post creation/editing page with AI generation button
- [x] Post queue management page
- [x] Analytics/insights page per brand
- [x] Notification center (client pause/edit requests)
- [x] Auto-post toggle per brand

## Phase 5: Client Portal Pages
- [x] Client dashboard (their brand overview)
- [x] Client content calendar (view upcoming + past posts)
- [x] Managed tier: pause post, request edit functionality
- [x] Premium tier: edit post text, swap images, approve/reject posts
- [x] Premium tier: auto-post toggle
- [x] Connect Facebook OAuth button (Meta OAuth dialog)
- [x] Connect Instagram OAuth button (Meta OAuth dialog)

## Phase 6: AI Content Engine
- [x] Brand voice settings UI (per brand)
- [x] Content format templates (Hey Tony, Hook & Solve, Auditor, Local Tips, Machine Series, Print+Digital)
- [x] AI post generation with brand voice
- [x] AI image generation for post visuals
- [x] Content type rotation system

## Phase 7: Testing & Polish
- [x] Vitest tests for core routers (33 tests passing)
- [x] UI polish and responsive design
- [x] Error handling throughout
- [x] Loading states and empty states

## Phase 8: Delivery
- [x] README with deployment instructions
- [x] Final checkpoint and delivery

## Shopify Integration
- [x] Database: shopify_connections table (store URL, access token, brand link)
- [x] Database: shopify_products table (product data, images, collections)
- [x] Shopify service: pull products, collections, images from connected store
- [x] tRPC router: connect/disconnect Shopify, sync products, list products
- [x] Admin UI: "Connect Shopify" button in brand settings / Social Accounts page
- [x] AI engine: use Shopify product data as content source for product-focused posts
- [x] Content rotation: Shopify products mixed into rotation with other content types

## Service Spotlight
- [x] Database: services table (name, description, service areas, specials, CTA, images)
- [x] tRPC router: CRUD for services per brand
- [x] Admin UI: Service Spotlight section in brand profile (dedicated page)
- [x] Client UI: Service Spotlight section (Premium tier can edit via tRPC access control)
- [x] AI engine: use Service Spotlight data for service-focused posts (seasonal reminders, before/after, booking CTAs)
- [x] Every AI post can end with direct CTA (call, book, DM, visit website)

## Content Source Logic
- [x] AI engine checks: has Shopify? has Service Spotlight? has both?
- [x] Content rotation mixes product posts, service posts, and general brand voice content
- [x] General brand voice content always generated regardless of data sources

## Testing & Polish (Shopify + Service Spotlight)
- [x] Vitest tests for Shopify routers (getConnection, connect, disconnect, listProducts)
- [x] Vitest tests for Service Spotlight routers (list, create, update, delete)
- [x] Vitest tests for AI content sources integration
- [x] All 51 tests passing
- [x] AI Engine page: content source indicators (Shopify/Services badges)
- [x] AI Engine page: useContentSources toggle
- [x] Client Service Spotlight page with tier-based access (Premium: edit, Managed: view-only)
- [x] Service Spotlight nav items in sidebar (admin + client)
- [x] Integrations page renamed (Social Accounts → Integrations) with Shopify section

## Bug Fixes
- [x] Fix: p cannot contain nested div error on /admin dashboard page (changed p tags to span tags)

## Event Calendar & Promotion Engine
- [x] Database: events table (name, date, location, description, ticket link, recurrence, promo lead days)
- [x] Database: event_promotions table (event_id, post_id, promo_type, scheduled_date)
- [x] DB helpers: event CRUD, promotion sequence queries
- [x] Promotion sequence generator service (teaser, reminder, day-of, recap posts)
- [x] tRPC routers: event CRUD with role-based access (admin full, premium edit, managed view-only)
- [x] tRPC router: generate promotion sequence for event
- [x] AI content engine: event promotion post generation using event details + brand voice
- [x] Admin Events page with calendar view and event form
- [x] Client Events page with tier-based permissions
- [x] Events nav item in sidebar (admin + client)
- [x] Visual indicator on content calendar for event-related posts
- [x] Content type additions: event_teaser, event_reminder, event_day_of, event_recap
- [x] Recurring event support (weekly, biweekly, monthly patterns)
- [x] Configurable promo lead days per event
- [x] Vitest tests for event routers and promotion logic (64 tests total passing)

## Failure Guardrails & Email Notifications
- [x] Post failure handling: mark as "failed", auto-retry up to 3 times
- [x] Email notification service (admin gets all alerts, clients get actionable items only)
- [x] Unapproved post approaching publish time: email reminder to client, notify admin
- [x] Token expiration detection: warn before posting, show warning badge on brand dashboard
- [x] Content generation failure: fallback to template-based posts, notify admin
- [x] Error logging / System Health section in admin dashboard
- [x] tRPC routers for system health and error log queries

## Smart Image Generation
- [x] AI image generation for backgrounds/scenes (no text rendered in AI image)
- [x] Programmatic text overlay engine (SVG-based, brand name, CTA, hashtags as clean text layers)
- [x] Template-based graphics fallback for quotes, stats, tips post types
- [x] Integration with existing AI Engine page for smart image workflow
- [x] tRPC router for smart image generation with text overlay

## Self-Service Onboarding & GMK Branding
- [x] Database: onboarding_state table (user_id, step, data JSON, completed)
- [x] Database: brand_invites table (token, email, tier, created_by, used_at)
- [x] tRPC router: onboarding CRUD (save step, complete, get state)
- [x] tRPC router: AI onboarding assistant (context-aware LLM chat during setup)
- [x] tRPC router: admin brand approval (approve/reject pending brands, set tier)
- [x] tRPC router: generate invite link with signed token
- [x] Onboarding wizard UI: Step 1 - Brand basics (name, industry, website)
- [x] Onboarding wizard UI: Step 2 - Brand voice (tone, style, sample posts)
- [x] Onboarding wizard UI: Step 3 - Content sources (Shopify or Service Spotlight)
- [x] Onboarding wizard UI: Step 4 - Social accounts (connect Facebook/Instagram)
- [x] Onboarding wizard UI: Step 5 - Schedule preferences (post frequency, times)
- [x] Onboarding wizard UI: Step 6 - Review & launch
- [x] AI onboarding assistant chat widget (floating, context-aware)
- [x] Route guard: new users (no brand) → redirect to onboarding wizard
- [x] Admin approval gate: notify Gerrit when new brand is submitted
- [x] Admin UI: pending brands approval queue in dashboard (OnboardingApproval page)
- [x] Landing page: "The Signal by GMK Web Solutions" branding
- [x] Login page: GMK logo + tagline
- [x] Sidebar footer: "Powered by GMK Web Solutions"
- [x] Subdomain-ready: meta tags, og:title, og:description for thesignal.gmkwebsolutions.com

## Cron Auto-Posting Scheduler
- [x] /api/cron/publish endpoint (Railway-compatible GET+POST, setInterval fallback)
- [x] Query posts due to publish (scheduled time passed, status scheduled/approved)
- [x] Call Meta Graph API for Facebook Page posts
- [x] Call Meta Graph API for Instagram Business posts
- [x] On success: mark post published with timestamp
- [x] On failure: increment retry count, mark failed after 3 attempts, notify admin
- [x] Token expiration detection and warning
- [x] Log all cron activity to error_logs / System Health
- [x] Cron secret key protection (CRON_SECRET env var, optional)
- [x] setInterval fallback for non-Railway hosting (DISABLE_IN_PROCESS_CRON flag)

## GMK Web Solutions Brand Seed
- [x] Seed brand: GMK Web Solutions (Gerrit, Hillsboro OR) — Brand ID 1
- [x] Seed brand voice settings (professional, direct, no-fluff, educational, value-first)
- [x] Seed 5 services in Service Spotlight
- [x] Seed service areas (Hillsboro, Beaverton, Tigard, Forest Grove, Aloha, Washington County)
- [x] Seed content type preferences and posting frequency
- [x] Vitest tests for cron scheduler logic (16 tests, 95 total passing)
- [x] README updated with cron setup and seed script documentation

## AI Engine UX Improvements
- [x] Regenerate button on AI Engine page (get fresh variation without clearing form)
- [x] Hey Tony topic override field (optional text input to steer tip topic)
- [x] Copy to clipboard button on generated post preview (with checkmark feedback)

## Fill Schedule (Batch Content Queue Generator)
- [x] Server procedure: ai.fillSchedule — accepts brandId, windowDays (7/15/30), postsPerDay (1/2), startTime, secondPostTime, formatRotation, startDate, createAs (draft/scheduled)
- [x] Content engine: generateBatch() — cycles through format rotation, skips days already covered, returns array of {content, contentType, scheduledAt, imagePrompt}
- [x] Skip logic: query existing scheduled/draft posts in window, avoid double-posting same day/time slot
- [x] Fill Schedule UI — FillScheduleModal on AI Engine page with preview before confirming
- [x] Show generated post count and date range in confirmation toast

## Carousel Post Support
- [x] Schema: add isCarousel boolean, carouselSlides JSON field to posts table
- [x] Run pnpm db:push to migrate (0006_smiling_bill_hollister.sql)
- [x] Content engine: generateCarouselPost() — returns 4-6 slides [{headline, body, imagePrompt}]
- [x] AI Engine UI: carousel slide builder — add/remove/reorder slides, per-slide copy editor, per-slide image generation
- [x] Carousel tab on AI Engine page (Single Post / Carousel tabs)
- [x] Cron publisher: detect isCarousel, route to carousel publishers
- [x] Instagram carousel: 3-step API (slide containers → carousel container → publish)
- [x] Facebook carousel: child_attachments array
- [x] generateCarousel + saveCarousel tRPC procedures

## DM Chatbot Lead Generation System
- [x] Database: leads, dm_conversations, chatbot_flows tables created
- [x] pnpm db:push migration (0007 + 0008 applied)
- [x] DB helpers: createLead, getLeadsByBrand, updateLead, upsertConversation, getConversation, getChatbotFlow
- [x] Meta webhook endpoint: GET /api/webhooks/meta (verification challenge)
- [x] Meta webhook endpoint: POST /api/webhooks/meta (receive DM events)
- [x] Webhook signature verification (X-Hub-Signature-256)
- [x] Chatbot state machine: greeting → ask_service → ask_contact → ask_time → closing
- [x] Meta send-message API: reply via Instagram DM and Facebook Messenger
- [x] Brand voice integration: greetings and messages use brand voice settings
- [x] Lead capture: save to leads table when conversation completes
- [x] Email notification to admin/client when lead is captured
- [x] tRPC routers: leads CRUD, chatbot flow config CRUD
- [x] Admin Leads page: table of all leads with status, filter by brand/platform/status
- [x] Client Leads page: view their own leads
- [x] Chatbot Flow Config UI: per-brand greeting, service list, closing message editor
- [x] Leads nav item in sidebar (admin + client)
- [x] WEBHOOK_VERIFY_TOKEN env var for Meta webhook setup

## Post Preview Panel
- [x] PostPreviewPanel component: side-by-side Facebook and Instagram mockup frames
- [x] Character count display (Facebook: 63,206 limit, Instagram: 2,200 limit)
- [x] Hashtag formatting: highlighted in preview, count with IG limit warning
- [x] Carousel preview: swipeable frame-by-frame with dot indicators
- [x] Available on AI Engine page (after generation, before save)
- [x] Available on Posts page via Eye button → preview dialog
- [x] Toggle between Facebook and Instagram preview tabs

## Posts Needing Images Filter
- [x] "Needs Image" filter button with count badge on Posts page
- [x] Filter logic: toggles to show only posts where imageUrl is null/empty
- [x] Visual "No Image" badge (yellow) on each post card that lacks an image
- [x] Count badge on filter button showing total posts needing images
- [x] Empty state message when all posts have images

## Fill Schedule — Image Generation in Batch
- [x] generateBatch() calls smart image generation for each post after content is generated
- [x] Carousel posts in batch: generate per-slide images
- [x] Image generation failures are non-fatal (post saved without image, flagged as needs-image)
- [x] FillScheduleModal shows image generation progress separately from content generation
- [x] fillSchedule tRPC procedure updated to include imageUrl on each created post

## Media Upload Override
- [x] Schema: add uploadedMediaUrl, uploadedMediaType fields to posts table
- [x] pnpm db:push migration (0009_charming_beast.sql)
- [x] S3 upload: server-side multipart endpoint POST /api/upload/media
- [x] Tier-based access control: admin always, premium client for own brand
- [x] MediaUploadButton component: drag-drop zone, file picker, progress bar, preview
- [x] AI Engine page: Upload Your Own Media section
- [x] Posts editor: MediaUploadButton in compact mode
- [x] CarouselBuilder: per-slide upload via compact MediaUploadButton
- [x] Support JPG, PNG, WebP, MP4 formats (50MB max)

## Standalone Email/Password Auth (Replace Manus OAuth)
- [x] Add passwordHash, passwordResetToken, passwordResetExpires fields to users table
- [x] pnpm db:push migration
- [x] Server auth service: register, login, verifyPassword, generateJWT, verifyJWT
- [x] bcrypt password hashing
- [x] JWT session tokens (cookie-based, same cookie name for compatibility)
- [x] POST /api/auth/register endpoint
- [x] POST /api/auth/login endpoint
- [x] POST /api/auth/logout endpoint
- [x] POST /api/auth/reset-password-request endpoint
- [x] POST /api/auth/reset-password endpoint
- [x] Remove Manus OAuth callback route (/api/oauth/callback)
- [x] Remove sdk.ts Manus SDK dependency from auth flow
- [x] Update context.ts to use standalone JWT verification
- [x] Login page at /login (email + password form)
- [x] Signup page at /signup (with Stripe payment)
- [x] Password reset page at /reset-password
- [x] Admin: create accounts from admin panel
- [x] Update useAuth hook and auth context for standalone auth
- [x] Remove all VITE_OAUTH_PORTAL_URL, OAUTH_SERVER_URL, VITE_APP_ID dependencies
- [x] App works fully self-contained with no Manus dependencies

## Stripe Payment Integration
- [x] Stripe service with checkout sessions, customer portal, webhook handling
- [x] STRIPE_SECRET_KEY and VITE_STRIPE_PUBLISHABLE_KEY env vars (user adds later)
- [x] Stripe Checkout for tier selection (Managed/Premium)
- [x] POST /api/stripe/create-checkout-session endpoint
- [x] POST /api/webhooks/stripe endpoint for Stripe events
- [x] Handle: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- [x] On successful payment: subscription activated, user logged in
- [x] Add stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus to users table
- [x] Admin can see subscription status per client (via users table)
- [x] Graceful fallback: app works without Stripe keys (admin can create accounts manually)
- [x] Recurring monthly subscription support

## Deployment
- [x] Push updated code to GitHub (gmkws/the-signal)
- [x] Railway auto-deploys from push

## Railway Healthcheck Fix
- [x] Fix Stripe webhook raw body: move before global JSON parser to avoid conflict
- [x] Fix PORT binding: Railway requires exact PORT, remove findAvailablePort fallback in production
- [x] Add explicit health check endpoint GET /api/health
- [x] Ensure server binds to 0.0.0.0 (not just localhost) for Railway
- [x] Test production build locally
- [ ] Push fix to GitHub
