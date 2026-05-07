# The Signal — Developer Notes

## Project Overview
AI-powered social media automation platform for small businesses.
Stack: Express + tRPC + Drizzle ORM (MySQL) + React + Vite.

## Database

### Schema & Migrations
- Drizzle ORM schema: `drizzle/schema.ts`
- Migrations folder: `drizzle/`
- Push to DB: `pnpm db:push`

### Google Business Profile (GBP) Schema — **LIVE** (db:push complete)
`social_accounts` table already supports GBP:
- `platform`: enum includes `"google_business"`
- `gbpLocationId`: full GBP location resource name (e.g. `accounts/123/locations/456`)
- `accessToken` / `refreshToken`: Google OAuth 2.0 tokens
- `tokenExpiresAt`: used for refresh management in cronEngine

`posts` table has `googleBusinessPostId` for tracking published GBP posts.

`.env` is configured with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## GBP Integration Architecture

### Service
`server/services/googleBusiness.ts` — raw `fetch`, no new npm packages.
Pattern mirrors `server/services/meta.ts`.

### tRPC Router
`gbpRouter` in `server/routers.ts` (exported as `gbp` on appRouter):
- `gbp.getOAuthUrl` — returns Google OAuth URL for popup
- `gbp.handleCallback` — exchanges code for tokens, returns location list
- `gbp.connect` — saves selected location as a social account
- `gbp.disconnect` — removes GBP social account

### Publish Loop
`server/services/cronEngine.ts` — `publishPost()` handles `"google_business"` platform.
Includes automatic token refresh when `tokenExpiresAt` is past.

### Settings UI
`client/src/pages/admin/SocialAccounts.tsx` — "Connect Google Business" button +
location selector dialog, following the same layout as the Meta OAuth card.

### OAuth Flow (popup pattern)
1. Admin clicks "Connect Google Business" on Integrations page.
2. `trpc.gbp.getOAuthUrl({ brandId })` → build URL, open popup.
3. Google redirects → `/api/google/callback?code=...&state=brandId`.
4. Callback page sends code back via `window.opener.postMessage`.
5. Frontend calls `trpc.gbp.handleCallback({ brandId, code, redirectUri })` → tokens + locations.
6. Admin selects a location → `trpc.gbp.connect(...)` saves the social account.

### CRITICAL — `noopener` MUST NOT be used in `window.open` for OAuth popups
`noopener` sets `window.opener = null` inside the popup, silently breaking the entire
`postMessage` relay. All three OAuth popups (Facebook, Instagram, GBP) must open without it:
```js
window.open(url, "fb_oauth", "width=600,height=700");  // ✅ correct
window.open(url, "fb_oauth", "width=600,height=700,noopener");  // ❌ breaks postMessage
```

## Pattern Reference
- Meta (Facebook / Instagram): `server/services/meta.ts`
- Google Business: `server/services/googleBusiness.ts` (same raw-fetch pattern)
- **No new npm packages** — use native `fetch` throughout.

## Key Environment Variables
| Variable | Purpose |
|---|---|
| `META_APP_ID` | Facebook OAuth — Main Production Meta App ID |
| `META_APP_SECRET` | Facebook OAuth — Main Production Meta App Secret |
| `INSTAGRAM_APP_ID` | Instagram OAuth — Instagram Login App ID |
| `INSTAGRAM_APP_SECRET` | Instagram OAuth — Instagram Login App Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `OPENAI_API_KEY` | AI content generation + image generation (gpt-image-1) |
| `DATABASE_URL` | MySQL connection string |
| `R2_*` | Cloudflare R2 image storage |
| `STRIPE_SECRET_KEY` | Stripe billing (optional) |

## Future Features / Pending Integrations

### 321 Trailers — Inventory Integration
Pending development. Waiting on the specific name of the client's dealer management software to determine if we can use a REST API, an XML/CSV inventory feed, or if web scraping is required to pull trailer inventory into The Signal's auto-posting engine.

## Image Generation

### Model: `gpt-image-1` (migrated 2026-04-20)
Replaced `dall-e-3` due to OpenAI deprecation effective 2025-05-12.

**Files changed:**
- `server/_core/imageGeneration.ts` — model, quality enum, size enum, removed `response_format`
- `server/services/contentEngine.ts` — `quality: "hd"` → `quality: "high"`

**API diff from dall-e-3:**
| Parameter | Old (dall-e-3) | New (gpt-image-1) |
|---|---|---|
| `model` | `"dall-e-3"` | `"gpt-image-1"` |
| `quality` | `"standard" \| "hd"` | `"low" \| "medium" \| "high"` |
| `size` (landscape) | `"1792x1024"` | `"1536x1024"` |
| `size` (portrait) | `"1024x1792"` | `"1024x1536"` |
| `response_format` | `"b64_json"` (explicit) | removed — always base64 |

Endpoint (`https://api.openai.com/v1/images/generations`) and response shape (`data[0].b64_json`) are unchanged.

## Meta OAuth Architecture — Split-App Dual-Flow (updated 2026-05-07, debugging 2026-05-07)

Two fully independent OAuth flows using **separate app credentials**. Facebook uses the
Main Production Meta App; Instagram uses the dedicated "Instagram API with Instagram Login"
product (its own App ID and Secret). The two flows share no credentials and hit different
authorization servers.

### Facebook Flow (Main Meta App)
- **App credentials:** `process.env.META_APP_ID` / `process.env.META_APP_SECRET`
- **Auth endpoint:** `https://www.facebook.com/v19.0/dialog/oauth`
- **Callback:** `https://thesignal.gmkwebsolutions.com/api/meta/facebook/callback`
- **Scopes:** `public_profile, pages_show_list, pages_manage_posts, pages_read_engagement`
- **No config_id** — removed; was causing UI hijacking
- **postMessage type:** `FB_OAUTH_CODE` / `FB_OAUTH_ERROR`
- **tRPC:** `meta.getFacebookOAuthUrl` + `meta.handleFacebookCallback`
- **Token exchange:** FB Graph API code → short-lived user token → long-lived (~60d) via `fb_exchange_token` → `/me/accounts` → page access tokens saved

### Instagram Flow (Instagram Login Product)
- **App credentials:** `process.env.INSTAGRAM_APP_ID` / `process.env.INSTAGRAM_APP_SECRET`
- **Auth endpoint:** `https://www.instagram.com/oauth/authorize` (direct — no Facebook bridge)
- **Callback:** `https://thesignal.gmkwebsolutions.com/api/meta/instagram/callback`
- **Scopes:** `instagram_business_basic, instagram_business_content_publish`
- **postMessage type:** `IG_OAUTH_CODE` / `IG_OAUTH_ERROR`
- **tRPC:** `meta.getInstagramOAuthUrl` + `meta.handleInstagramCallback`
- **Token exchange (3-step, no FB Graph):**
  1. POST `https://api.instagram.com/oauth/access_token` (form-encoded) → short-lived token + `user_id`
  2. GET `https://graph.instagram.com/access_token?grant_type=ig_exchange_token` → long-lived token (~60d)
  3. GET `https://graph.instagram.com/me?fields=id,name,username` → account info

### Why the split?
The Facebook flow is a standard Meta/Facebook Login app (pages + publishing permissions).
The Instagram flow now uses the **"Instagram API with Instagram Login"** product — a separate
Meta app type that authorizes directly via `instagram.com` without requiring a Facebook Page
as a bridge. `instagram_business_*` scopes are only available through this product.

### Environment variables (Railway)
| Variable | Used by |
|---|---|
| `META_APP_ID` | Facebook flow — Main Production Meta App ID |
| `META_APP_SECRET` | Facebook flow — Main Production Meta App Secret |
| `INSTAGRAM_APP_ID` | Instagram flow — Instagram Login App ID |
| `INSTAGRAM_APP_SECRET` | Instagram flow — Instagram Login App Secret |

---

## Privacy Policy Page (added 2026-05-06)

Added a public `/privacy` route required for Meta Developer portal submission.

**Files changed:**
- `client/src/pages/PrivacyPolicy.tsx` — standalone page, no DashboardLayout wrapper
- `client/src/App.tsx` — route added in both the unauthenticated and authenticated
  branches of `AuthRouter`, before the catch-all, so it renders without the dashboard shell

**Live URL:** `https://thesignal.gmkwebsolutions.com/privacy`

Policy covers: third-party OAuth (Facebook, Google, LinkedIn), social-posting data usage,
data retention schedules, security measures, and user rights. Owned by GMK Web Solutions.
Contact email in the policy: `privacy@gmkwebsolutions.com`.

---

## OAuth postMessage Debug State (as of 2026-05-07)

Temporary diagnostics are in place — **remove when the flow is confirmed working:**

| File | Diagnostic | Remove when |
|---|---|---|
| `server/_core/index.ts` | `🚨 BACKEND HIT` + `🚨 BACKEND SUCCESS` logs in FB callback | Flow confirmed working |
| `server/_core/index.ts` | `🚨 [TOP LEVEL] API Request Intercepted` nuclear intercept | Flow confirmed working |
| `server/_core/index.ts` | Popup heartbeat `console.log('Sending message to opener:', ...)` in HTML `<script>` | Flow confirmed working |
| `client/src/pages/admin/SocialAccounts.tsx` | `🚨 POSTMESSAGE RECEIVED` log | Flow confirmed working |
| `client/src/pages/admin/SocialAccounts.tsx` | Origin check commented out (`event.origin !== window.location.origin`) | **Re-enable this check** once messages are confirmed arriving |

---

## Focus Bug (resolved in working tree)
The `formatForDisplay` helper in `client/src/components/PostPreviewPanel.tsx`
used `key={i}` (index) for spans. When the hashtag count changed mid-typing,
React destroyed and recreated many span nodes, occasionally causing the browser
to lose focus on the parent Textarea. Fixed by using `key={\`${i}:${part}\`}`.
