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
