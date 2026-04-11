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
| `OPENAI_API_KEY` | AI content generation + DALL-E |
| `DATABASE_URL` | MySQL connection string |
| `R2_*` | Cloudflare R2 image storage |
| `STRIPE_SECRET_KEY` | Stripe billing (optional) |

## Focus Bug (resolved in working tree)
The `formatForDisplay` helper in `client/src/components/PostPreviewPanel.tsx`
used `key={i}` (index) for spans. When the hashtag count changed mid-typing,
React destroyed and recreated many span nodes, occasionally causing the browser
to lose focus on the parent Textarea. Fixed by using `key={\`${i}:${part}\`}`.
