/**
 * GMK Web Solutions Seed Script
 *
 * Seeds the database with GMK Web Solutions as the first brand,
 * including all services, service areas, and brand voice settings
 * based on the official brand guidelines.
 *
 * Run with: npx tsx server/db/seedGMK.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { brands, services } from "../../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL!);
  const db = drizzle(connection);

  console.log("🌱 Seeding GMK Web Solutions brand...\n");

  // ── Check if brand already exists ──────────────────────────────────────
  const existing = await db
    .select()
    .from(brands)
    .where(eq(brands.slug, "gmk-web-solutions"))
    .limit(1);

  let brandId: number;

  const voiceSettings = {
    tone: "Professional, direct, no-fluff, educational",
    style: "Value-first, community-first, conversational authority",
    keywords: [
      "web development",
      "AI automation",
      "SEO",
      "digital marketing",
      "local business",
      "Hillsboro",
      "Washington County",
      "Oregon",
      "small business",
      "website design",
      "print production",
      "branding",
      "Google ranking",
      "online presence",
    ],
    avoidWords: [
      "guru",
      "ninja",
      "rockstar",
      "synergy",
      "leverage",
      "disruptive",
      "game-changer",
      "hustle",
      "crushing it",
      "killing it",
    ],
    samplePosts: [
      "Most small business websites are losing customers before they even say hello. Here's what to fix first: [tip]. If your site doesn't load in 3 seconds, 53% of visitors leave. We fix that.",
      "Hey Tony — quick tip for local businesses in Hillsboro: Google Business Profile posts still work. One post per week keeps you visible in local search. Takes 5 minutes. Do it.",
      "Your website should be your best salesperson. If it's not converting visitors into calls or leads, something's broken. Let's audit it.",
      "AI automation isn't just for big companies. We're helping local Oregon businesses automate their follow-ups, social posts, and customer communications. Ask us how.",
      "SEO isn't magic. It's consistency. Show up in search results for Hillsboro and Washington County by doing the basics right, every week.",
    ],
    customInstructions:
      "GMK Web Solutions serves small and medium businesses in Hillsboro, Beaverton, Tigard, Forest Grove, Aloha, and greater Washington County, Oregon. Owner is Gerrit. Content should feel like advice from a knowledgeable local expert — not a corporate marketing team. Use specific local references when possible. Educational content should be actionable and immediately useful. Avoid vague platitudes. The 'Hey Tony' series addresses common small business owner questions directly. Always lead with value before any pitch.",
  };

  if (existing.length > 0) {
    brandId = existing[0].id;
    console.log(`✅ Brand "GMK Web Solutions" already exists (ID: ${brandId}). Updating...`);

    await db
      .update(brands)
      .set({
        name: "GMK Web Solutions",
        industry: "Web Development, AI Automation, SEO, Design",
        location: "Hillsboro, Oregon",
        website: "https://gmkwebsolutions.com",
        clientTier: "premium",
        autoPostEnabled: true,
        isActive: true,
        voiceSettings,
      })
      .where(eq(brands.id, brandId));
  } else {
    console.log('Creating brand "GMK Web Solutions"...');

    const result = await db.insert(brands).values({
      name: "GMK Web Solutions",
      slug: "gmk-web-solutions",
      industry: "Web Development, AI Automation, SEO, Design",
      location: "Hillsboro, Oregon",
      website: "https://gmkwebsolutions.com",
      clientTier: "premium",
      autoPostEnabled: true,
      isActive: true,
      voiceSettings,
    });

    brandId = (result[0] as any).insertId;
    console.log(`✅ Brand created with ID: ${brandId}`);
  }

  // ── Seed Services ───────────────────────────────────────────────────────
  const gmkServices = [
    {
      name: "Web Development & Design",
      description:
        "Custom websites built for local Oregon businesses. Fast, mobile-first, conversion-optimized. From simple brochure sites to full e-commerce platforms. We build sites that actually work for your business — not just look pretty.",
      serviceAreas: ["Hillsboro", "Beaverton", "Tigard", "Forest Grove", "Aloha", "Washington County", "Portland Metro"],
      ctaType: "visit_website" as const,
      ctaText: "Get a Free Website Audit",
      ctaLink: "https://gmkwebsolutions.com/contact",
      displayOrder: 1,
    },
    {
      name: "AI Automation",
      description:
        "Automate repetitive business tasks using AI. Customer follow-ups, social media posting, lead nurturing, appointment reminders, and more. We set it up so you can focus on running your business.",
      serviceAreas: ["Hillsboro", "Beaverton", "Tigard", "Forest Grove", "Aloha", "Washington County"],
      ctaType: "visit_website" as const,
      ctaText: "See What We Can Automate",
      ctaLink: "https://gmkwebsolutions.com/ai-automation",
      displayOrder: 2,
    },
    {
      name: "SEO & Local Search",
      description:
        "Get found on Google by customers in your area. Local SEO, Google Business Profile optimization, keyword targeting for Washington County and surrounding cities. Real results, no smoke and mirrors.",
      serviceAreas: ["Hillsboro", "Beaverton", "Tigard", "Forest Grove", "Aloha", "Washington County", "Portland Metro"],
      ctaType: "visit_website" as const,
      ctaText: "Check Your Google Ranking",
      ctaLink: "https://gmkwebsolutions.com/seo",
      displayOrder: 3,
    },
    {
      name: "Creative & Branding Design",
      description:
        "Logo design, brand identity, marketing materials, and visual assets that represent your business professionally. From business cards to full brand guidelines. Look the part.",
      serviceAreas: ["Hillsboro", "Beaverton", "Tigard", "Forest Grove", "Aloha", "Washington County"],
      ctaType: "visit_website" as const,
      ctaText: "View Our Portfolio",
      ctaLink: "https://gmkwebsolutions.com/design",
      displayOrder: 4,
    },
    {
      name: "Print Production",
      description:
        "Business cards, flyers, banners, brochures, and signage. We handle design and print coordination so you get professional printed materials without the hassle. Local pickup available in Hillsboro.",
      serviceAreas: ["Hillsboro", "Beaverton", "Tigard", "Forest Grove", "Aloha", "Washington County"],
      ctaType: "visit_website" as const,
      ctaText: "Get a Print Quote",
      ctaLink: "https://gmkwebsolutions.com/print",
      displayOrder: 5,
    },
  ];

  console.log("\n🔧 Seeding services...");

  // Get existing services for this brand
  const existingServices = await db
    .select()
    .from(services)
    .where(eq(services.brandId, brandId));

  for (const service of gmkServices) {
    const alreadyExists = existingServices.find(
      (s) => s.name === service.name
    );

    if (alreadyExists) {
      console.log(`  ↻ Service "${service.name}" already exists, updating...`);
      await db
        .update(services)
        .set({
          description: service.description,
          serviceAreas: service.serviceAreas,
          ctaType: service.ctaType,
          ctaText: service.ctaText,
          ctaLink: service.ctaLink,
          displayOrder: service.displayOrder,
          isActive: true,
        })
        .where(eq(services.id, alreadyExists.id));
    } else {
      console.log(`  + Adding service "${service.name}"...`);
      await db.insert(services).values({
        brandId,
        name: service.name,
        description: service.description,
        serviceAreas: service.serviceAreas,
        ctaType: service.ctaType,
        ctaText: service.ctaText,
        ctaLink: service.ctaLink,
        displayOrder: service.displayOrder,
        isActive: true,
      });
    }
  }

  console.log("\n✅ GMK Web Solutions seed complete!");
  console.log(`\n📋 Summary:`);
  console.log(`   Brand ID: ${brandId}`);
  console.log(`   Brand: GMK Web Solutions`);
  console.log(`   Location: Hillsboro, Oregon`);
  console.log(`   Industry: Web Development, AI Automation, SEO, Design`);
  console.log(`   Tier: Premium`);
  console.log(`   Auto-post: Enabled`);
  console.log(`   Services: ${gmkServices.length} seeded`);
  console.log(`\n🚀 The brand is ready for content generation!`);

  await connection.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
