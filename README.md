# The Signal

**Social Media Automation Platform by GMK Web Solutions**

The Signal is a full-featured social media automation platform that generates AI-powered content and auto-posts to Instagram and Facebook. Built for GMK Web Solutions to manage multiple client brands from a single admin dashboard.

---

## Features

### Admin Dashboard
- Overview of all brands and content with real-time stats
- Brand management (create, edit, delete) supporting up to 5 client brands
- Content calendar with upcoming and past post views
- Post creation, editing, and deletion with scheduling
- AI content generation using brand-specific voice settings
- AI image generation for post visuals
- Auto-post toggle per brand (automatic vs. queued for review)
- Notification center for client pause/edit requests
- Analytics and insights per brand
- Social account management (Facebook + Instagram via Meta Graph API)
- User management for client access

### Client Portal (Two Tiers)

**Managed Tier** — View-only access with limited controls:
- View content calendar and scheduled posts
- Pause scheduled posts
- Request edits (sends notification to admin)

**Premium Tier** — Full editing and approval capabilities:
- Edit post text and swap images
- Approve or reject posts before publishing
- Toggle auto-post on/off
- Full calendar and notification access

### AI Content Engine
- Brand voice customization (tone, style, keywords, sample posts)
- Six content format templates:
  - "Hey Tony" value-first tips
  - Hook & Solve (problem → solution)
  - The Auditor showcase posts
  - Local Hillsboro/Washington County business tips
  - "Your website is a machine" educational series
  - Print + digital capability highlights
- AI-powered post generation in each brand's voice
- AI image generation for post visuals

### Meta API Integration
- Facebook posting via Meta Graph API (`pages_manage_posts`)
- Instagram posting via Instagram Graph API (`instagram_content_publish`)
- OAuth connection flow for Facebook Pages and Instagram Business accounts
- Scheduled posting with configurable times
- Post queue management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Recharts |
| Backend | Node.js, Express 4, tRPC 11 |
| Database | MySQL/TiDB via Drizzle ORM |
| Auth | Manus OAuth with role-based access control |
| AI | Built-in LLM integration for content generation |
| Storage | S3-compatible object storage for media |
| APIs | Meta Graph API (Facebook + Instagram) |

---

## Project Structure

```
client/
  src/
    pages/
      admin/          # Admin dashboard pages
      client/         # Client portal pages
      Home.tsx         # Landing page
    components/        # Shared UI components
    lib/trpc.ts        # tRPC client binding
    App.tsx            # Routes & layout
    index.css          # Global theme (dark navy/cyan)

server/
  routers.ts           # tRPC procedures (all features)
  db.ts                # Database query helpers
  services/
    meta.ts            # Meta Graph API integration
    contentEngine.ts   # AI content generation service
  storage.ts           # S3 file storage helpers

drizzle/
  schema.ts            # Database tables & types

shared/
  types.ts             # Shared constants & types
  const.ts             # App constants
```

---

## Environment Variables

The following environment variables are required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal URL |
| `BUILT_IN_FORGE_API_URL` | LLM/AI API endpoint |
| `BUILT_IN_FORGE_API_KEY` | LLM/AI API key (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend AI API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend AI API URL |

### Optional (for Meta API)

| Variable | Description |
|----------|-------------|
| `META_APP_SECRET` | Meta App Secret for OAuth token exchange |

The Meta App ID (`868128566280243`) is configured in `shared/types.ts`. Access tokens for Facebook Pages and Instagram Business accounts are managed per-brand through the Social Accounts admin page.

---

## Database Setup

The database schema is managed by Drizzle ORM. Tables include:

- `users` — Authentication and role management
- `brands` — Client brands with voice settings
- `posts` — Content posts with scheduling and status tracking
- `social_accounts` — Connected Facebook/Instagram accounts
- `notifications` — Client-admin notification system
- `analytics` — Post performance metrics

To push schema changes:

```bash
pnpm db:push
```

---

## Development

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check
```

The dev server runs at `http://localhost:3000` with hot module replacement.

---

## Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Deployment

### Railway

1. Create a new project and connect your repository
2. Add a MySQL database service
3. Set environment variables in the Railway dashboard
4. Deploy — Railway will auto-detect the build and start commands

### Render

1. Create a new Web Service
2. Set build command: `pnpm install && pnpm build`
3. Set start command: `pnpm start`
4. Add environment variables in the Render dashboard
5. Provision a MySQL database and set `DATABASE_URL`

### DigitalOcean App Platform

1. Create a new App from your repository
2. Set build command: `pnpm install && pnpm build`
3. Set run command: `pnpm start`
4. Add a managed MySQL database
5. Configure environment variables

### Custom Domain

The application is designed to be hosted at `app.gmkwebsolutions.com`. Configure your DNS to point to your hosting provider's assigned URL.

---

## Meta API Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. The app is configured with App ID: `868128566280243`
3. Required permissions:
   - `pages_manage_posts` — Publish to Facebook Pages
   - `pages_read_engagement` — Read page insights
   - `instagram_basic` — Read Instagram profile
   - `instagram_content_publish` — Publish to Instagram
4. Set the OAuth redirect URI to: `https://app.gmkwebsolutions.com/api/meta/callback`
5. Connect accounts through the Social Accounts page in the admin dashboard

---

## Testing

The project includes comprehensive Vitest tests covering all tRPC routers:

```bash
pnpm test
```

Test coverage includes:
- Authentication and authorization (admin vs. client roles)
- Brand CRUD operations with MAX_BRANDS enforcement
- Post creation, editing, deletion, and review workflows
- Client tier access control (Managed vs. Premium)
- Notification system (pause requests, edit requests)
- Social account management
- AI content generation
- Analytics queries

---

## Brand Configuration

Each brand supports:
- **Voice Settings** — Tone, style, keywords, avoid-words, sample posts, custom instructions
- **Client Tier** — Managed (view-only) or Premium (full editing)
- **Auto-Post Toggle** — Automatic publishing vs. manual review queue
- **Social Accounts** — Connected Facebook Pages and Instagram Business accounts
- **Content Calendar** — Scheduled posts with configurable times

The platform supports up to 5 client brands, with GMK Web Solutions as the first brand.

---

## License

Proprietary — GMK Web Solutions. All rights reserved.
