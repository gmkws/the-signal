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
