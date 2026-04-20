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

## Pattern Reference
- Meta (Facebook / Instagram): `server/services/meta.ts`
- Google Business: `server/services/googleBusiness.ts` (same raw-fetch pattern)
- **No new npm packages** — use native `fetch` throughout.

## Key Environment Variables
| Variable | Purpose |
|---|---|
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

## Focus Bug (resolved in working tree)
The `formatForDisplay` helper in `client/src/components/PostPreviewPanel.tsx`
used `key={i}` (index) for spans. When the hashtag count changed mid-typing,
React destroyed and recreated many span nodes, occasionally causing the browser
to lose focus on the parent Textarea. Fixed by using `key={\`${i}:${part}\`}`.
