/**
 * AI Content Engine for generating social media posts in brand voice.
 * Supports multiple content sources: general brand voice, Shopify products, and Service Spotlight.
 * Uses the built-in LLM helper for text generation and image generation service for visuals.
 */

import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";

export type ContentFormat =
  | "hey_tony"
  | "hook_solve"
  | "auditor_showcase"
  | "local_tips"
  | "machine_series"
  | "print_digital"
  | "shopify_product"
  | "service_spotlight"
  | "custom";

export interface BrandVoice {
  tone: string;
  style: string;
  keywords: string[];
  avoidWords: string[];
  samplePosts: string[];
  customInstructions: string;
}

export interface ShopifyProductData {
  title: string;
  description: string | null;
  price: string | null;
  compareAtPrice: string | null;
  productType: string | null;
  tags: string[];
  imageUrl: string | null;
  collections: string[];
  handle: string | null;
}

export interface ServiceData {
  name: string;
  description: string | null;
  serviceAreas: string[];
  specials: string | null;
  ctaType: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  ctaPhone: string | null;
  images: string[];
}

export interface ContentSourceInfo {
  hasShopify: boolean;
  hasServices: boolean;
  shopifyProduct?: ShopifyProductData;
  service?: ServiceData;
}

export interface GeneratedContent {
  content: string;
  contentType: ContentFormat;
  suggestedImagePrompt: string;
  overlayHeadline: string; // Short 3-8 word headline for image overlay text
}

const FORMAT_PROMPTS: Record<ContentFormat, string> = {
  hey_tony: `Write a value-first tip post in the "Hey Tony" style. "Hey Tony" is the NAME of this content format — it is NOT a greeting and must NOT appear anywhere in the post. Do not open with "Hey Tony", "Hey,", or any salutation.

This format speaks directly to a small business owner as if you're a knowledgeable friend giving them a free consult over coffee. The core idea: you're giving away genuinely useful advice that most agencies would charge a consultation fee for.

Pick ONE specific, actionable tip from the following topic areas — rotate through them and do NOT default to SEO every time:
- Website speed and performance (Core Web Vitals, image compression, hosting)
- Google Business Profile optimization and local map pack visibility
- AI automation for small business (follow-up sequences, chatbots, scheduling)
- Social media consistency and content batching
- Print + digital marketing integration (how physical materials support digital presence)
- Common website mistakes that silently cost leads (no clear CTA, broken mobile, slow load)
- Email marketing or automated follow-up workflows
- Branding and first impressions (logo, color consistency, photography)
- E-commerce conversion tips (product photos, checkout friction, abandoned cart)
- Photography and visual content for local businesses

Structure:
1. Open with a bold, specific hook — a surprising stat, a blunt truth, or a relatable pain point. Do NOT start with a question. Example hooks: "Your website loads in 6 seconds. Your competitor's loads in 2. Guess who gets the call.", "Most small businesses lose 40% of their leads because of one missing button."
2. Deliver the actual tip in 2–3 short paragraphs. Give away the REAL advice — specific steps they can take TODAY. Don't be vague. Name real tools, real numbers, real actions. This is what makes the format valuable — you're not teasing, you're teaching.
3. Close with: "Have questions? Feel free to DM or call. Answers don't cost anything, but they can pay off immensely."

Tone: Direct, conversational, zero fluff. Like a trusted expert who genuinely wants to help, not a marketer trying to sell. Think barbershop advice from someone who actually knows their stuff.`,

  hook_solve: `Create a "Hook & Solve" format post. This uses a highly visual, scannable format that grabs attention instantly and walks the reader through a specific problem and the exact solution. Structure: 1) Hook with a relatable problem statement 2) Explain why it matters 3) Present the clear solution 4) End with a CTA. Use short paragraphs and line breaks for readability.`,

  auditor_showcase: `Create an "Auditor Showcase" post highlighting a before/after website audit. Describe a common technical issue found during a site audit (like missing H1 tags, broken schema, slow load times, missing meta descriptions) and show the transformation. Use the "building inspector" analogy to make technical concepts accessible. Reference "The Auditor" tool.`,

  local_tips: `Create a local business tip post specifically for businesses in Hillsboro and Washington County, Oregon. Reference local landmarks, business districts, or community events. Provide actionable advice that local business owners can implement. Position the brand as a helpful neighbor and expert in the community.`,

  machine_series: `Create a post in the "Your Website Is a Machine" educational series. This format treats websites as engineered systems, not brochures. Explain a specific component of a well-functioning website (speed, architecture, SEO structure, mobile optimization, etc.) using mechanical/engineering metaphors. Emphasize stability and systems thinking over trends.`,

  print_digital: `Create a post highlighting the full-stack capability of combining digital and physical assets. Showcase how professional printing services (business cards, signage, branded merchandise) complement a strong digital presence. Emphasize the rare combination of web development, AI automation, AND in-house print production.`,

  shopify_product: `Create a product spotlight post that naturally showcases a product from the brand's online store. Do NOT make it a hard sales pitch — weave it into a story, tip, or lifestyle context. Show how the product solves a problem or fits into the customer's life. Include the product name and key details naturally. End with a soft CTA to check it out or shop the link.`,

  service_spotlight: `Create a service spotlight post that highlights a specific service the brand offers. Focus on the value and transformation the service provides, not just listing features. Use storytelling — paint a picture of the problem the customer faces and how this service solves it. Include the service area to build local relevance. End with a clear, direct CTA (call, book online, DM, or visit website).`,

  custom: `Create a professional, engaging social media post. Make it informative and actionable with a clear call-to-action.`,
};

/**
 * Determine which content type to generate based on available data sources.
 * Implements the rotation logic:
 * - Has Shopify? Mix product posts into rotation
 * - Has Service Spotlight? Mix service posts into rotation
 * - Has both? Use both in rotation
 * - Always generate general brand voice content regardless
 */
export function pickContentType(
  sourceInfo: ContentSourceInfo,
  requestedType?: ContentFormat
): ContentFormat {
  // If a specific type was requested, use it
  if (requestedType && requestedType !== "custom") {
    return requestedType;
  }

  // Build the rotation pool
  const generalTypes: ContentFormat[] = [
    "hey_tony", "hook_solve", "auditor_showcase",
    "local_tips", "machine_series", "print_digital",
  ];

  const pool: ContentFormat[] = [...generalTypes];

  // Add Shopify product posts to the rotation if connected and product available
  if (sourceInfo.hasShopify && sourceInfo.shopifyProduct) {
    pool.push("shopify_product");
    pool.push("shopify_product"); // Weight it slightly
  }

  // Add service spotlight posts to the rotation if services exist
  if (sourceInfo.hasServices && sourceInfo.service) {
    pool.push("service_spotlight");
    pool.push("service_spotlight"); // Weight it slightly
  }

  // Pick randomly from the pool
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Build additional context for the AI based on content source data
 */
function buildSourceContext(
  contentType: ContentFormat,
  sourceInfo: ContentSourceInfo
): string {
  let context = "";

  if (contentType === "shopify_product" && sourceInfo.shopifyProduct) {
    const p = sourceInfo.shopifyProduct;
    context += `\n\nPRODUCT DATA (use this as the basis for the post):
- Product Name: ${p.title}
- Description: ${p.description || "No description available"}
- Price: ${p.price ? `$${p.price}` : "Contact for pricing"}${p.compareAtPrice ? ` (was $${p.compareAtPrice})` : ""}
- Product Type: ${p.productType || "General"}
- Tags: ${p.tags?.join(", ") || "None"}
- Collections: ${p.collections?.join(", ") || "General"}
${p.handle ? `- Product Link Handle: ${p.handle}` : ""}

IMPORTANT: This is ONE post in a content rotation. The brand also posts educational tips, local business advice, and value-first content. This product post should feel natural and not overly salesy. Weave the product into a story or tip format.`;
  }

  if (contentType === "service_spotlight" && sourceInfo.service) {
    const s = sourceInfo.service;
    context += `\n\nSERVICE DATA (use this as the basis for the post):
- Service Name: ${s.name}
- Description: ${s.description || "Professional service"}
- Service Areas: ${s.serviceAreas?.join(", ") || "Local area"}
${s.specials ? `- Current Special/Offer: ${s.specials}` : ""}
- CTA Type: ${s.ctaType || "visit_website"}
${s.ctaText ? `- CTA Text: ${s.ctaText}` : ""}
${s.ctaLink ? `- CTA Link: ${s.ctaLink}` : ""}
${s.ctaPhone ? `- Phone: ${s.ctaPhone}` : ""}

IMPORTANT: End the post with a clear, direct CTA based on the CTA type above. If it's "call", include the phone number. If it's "book_online", direct them to the booking link. If it's "dm", invite them to DM. If it's "visit_website", point them to the website. Make the CTA feel natural, not forced.`;
  }

  return context;
}

/**
 * Generate a social media post using AI in the brand's voice.
 * Now supports Shopify product data and Service Spotlight data as content sources.
 */
export async function generatePost(
  brandName: string,
  contentType: ContentFormat,
  voiceSettings?: BrandVoice | null,
  customTopic?: string,
  sourceInfo?: ContentSourceInfo
): Promise<GeneratedContent> {
  // If content type is auto/custom and we have source info, pick the best type
  const finalContentType = sourceInfo
    ? pickContentType(sourceInfo, contentType)
    : contentType;

  const formatPrompt = FORMAT_PROMPTS[finalContentType];

  let voiceInstructions = "";
  if (voiceSettings) {
    voiceInstructions = `
Brand Voice Guidelines:
- Tone: ${voiceSettings.tone}
- Style: ${voiceSettings.style}
- Key terms to use: ${voiceSettings.keywords.join(", ")}
- Words/phrases to avoid: ${voiceSettings.avoidWords.join(", ")}
${voiceSettings.customInstructions ? `- Additional instructions: ${voiceSettings.customInstructions}` : ""}
${voiceSettings.samplePosts.length > 0 ? `\nSample posts for voice reference:\n${voiceSettings.samplePosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
`;
  }

  // Build source-specific context
  const sourceContext = sourceInfo ? buildSourceContext(finalContentType, sourceInfo) : "";

  const systemPrompt = `You are a social media content strategist for ${brandName}. You create engaging, professional posts that drive engagement and build authority. Your posts should sound authentically human — NOT like AI generated content. Be direct, conversational, and value-driven.

${voiceInstructions}
${sourceContext}

Important rules:
- Keep posts under 2000 characters for optimal engagement
- Use line breaks for readability
- Include relevant hashtags (3-5 max)
- Include emojis sparingly and strategically
- End with a clear, low-friction call-to-action
- The post must be ready to publish as-is
- Every post should end with a direct CTA: call, book online, DM, or visit website`;

  const userPrompt = customTopic
    ? `${formatPrompt}\n\nSpecific topic to cover: ${customTopic}`
    : formatPrompt;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_post",
        strict: true,
        schema: {
          type: "object",
          properties: {
            postContent: {
              type: "string",
              description: "The complete social media post text, ready to publish",
            },
            overlayHeadline: {
              type: "string",
              description: "A scroll-stopping headline for the social media image (4-7 words MAX). Must create tension, curiosity, or urgency — NOT a generic label. Bad: 'Master Your Google Profile'. Good: 'Your Competitors Already Did This'. Bad: 'Website Speed Matters'. Good: 'Six Seconds. That's All You Get.' Use dashes, numbers, or provocative statements.",
            },
            imagePrompt: {
              type: "string",
              description: "A vivid scene description for an AI-generated background photo. Describe a SPECIFIC real-world scene with lighting, mood, and composition details. Example: 'Close-up of hands typing on a MacBook in a modern coffee shop, warm golden hour light streaming through windows, shallow depth of field, professional photography style'. Avoid abstract concepts — describe what the CAMERA SEES.",
            },
          },
          required: ["postContent", "overlayHeadline", "imagePrompt"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to generate content: empty response");
  }

  const parsed = JSON.parse(content);

  return {
    content: parsed.postContent,
    contentType: finalContentType,
    suggestedImagePrompt: parsed.imagePrompt,
    overlayHeadline: parsed.overlayHeadline || "",
  };
}

export interface PostImageResult {
  url: string;
  base64?: string; // raw base64 PNG data (available for embedding in SVGs)
}

/**
 * Generate an image for a social media post.
 * Returns URL (always) and base64 data (when available, for SVG embedding).
 */
export async function generatePostImage(prompt: string): Promise<PostImageResult> {
  // Keep the prompt concise — DALL-E 3 works best with shorter, focused prompts
  const trimmedPrompt = prompt.length > 500 ? prompt.substring(0, 500) : prompt;

  console.log(`[ImageGen] Generating image with prompt: ${trimmedPrompt.substring(0, 100)}...`);

  // Retry up to 2 times on transient 500 errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await generateImage({ prompt: trimmedPrompt, quality: "hd" });
      if (!result.url) throw new Error("Image generation returned no URL");
      return { url: result.url, base64: result.base64 };
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes("500") && attempt < 2) {
        console.warn(`[ImageGen] DALL-E 500 error, retrying (attempt ${attempt + 1}/3)...`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // Backoff: 2s, 4s
        continue;
      }
      throw err;
    }
  }
  throw lastError!;
}

// ── Batch Generation for Fill Schedule ────────────────────────────────────

export interface BatchSlot {
  scheduledAt: Date;
  contentType: ContentFormat;
}

export interface BatchGeneratedPost {
  content: string;
  contentType: ContentFormat;
  scheduledAt: Date;
  suggestedImagePrompt: string;
  overlayHeadline: string;      // Short headline for image overlay text
  imageUrl?: string;            // Generated image URL (undefined if generation failed)
  imageGenerationFailed?: boolean;
}

/**
 * Build a list of time slots for batch generation, skipping dates that already
 * have posts scheduled (based on the occupiedDates set — ISO date strings "YYYY-MM-DD").
 */
export function buildBatchSlots(
  startDate: Date,
  windowDays: number,
  postsPerDay: 1 | 2,
  firstPostHour: number,   // e.g. 9 for 9:00 AM
  secondPostHour: number,  // e.g. 17 for 5:00 PM — only used when postsPerDay === 2
  occupiedSlots: Set<string>, // "YYYY-MM-DD-HH" strings of already-scheduled slots
  formatRotation: ContentFormat[]
): BatchSlot[] {
  const slots: BatchSlot[] = [];
  let formatIndex = 0;

  for (let day = 0; day < windowDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

    const timesToPost: number[] = [firstPostHour];
    if (postsPerDay === 2) timesToPost.push(secondPostHour);

    for (const hour of timesToPost) {
      const slotKey = `${dateStr}-${String(hour).padStart(2, "0")}`;
      if (occupiedSlots.has(slotKey)) continue; // skip already-filled slots

      const scheduledAt = new Date(date);
      scheduledAt.setHours(hour, 0, 0, 0);

      const contentType = formatRotation[formatIndex % formatRotation.length];
      formatIndex++;

      slots.push({ scheduledAt, contentType });
    }
  }

  return slots;
}

/**
 * Generate a batch of posts for the Fill Schedule feature.
 * Generates posts AND images sequentially to avoid rate limiting.
 * Image generation is non-fatal — if it fails, the post is saved without an image
 * and flagged so the "Needs Image" filter can catch it.
 */
export async function generateBatch(
  brandName: string,
  slots: BatchSlot[],
  voiceSettings?: BrandVoice | null,
  sourceInfo?: ContentSourceInfo,
  generateImages = true
): Promise<BatchGeneratedPost[]> {
  const results: BatchGeneratedPost[] = [];

  for (const slot of slots) {
    try {
      // For service_spotlight and shopify_product, use the sourceInfo rotation
      const effectiveSourceInfo = (slot.contentType === "service_spotlight" || slot.contentType === "shopify_product")
        ? sourceInfo
        : undefined;

      const generated = await generatePost(
        brandName,
        slot.contentType,
        voiceSettings,
        undefined,
        effectiveSourceInfo
      );

      // Generate image for this post (non-fatal — post is saved without image if this fails)
      let imageUrl: string | undefined;
      let imageGenerationFailed = false;
      if (generateImages && generated.suggestedImagePrompt) {
        try {
          const imgResult = await generatePostImage(generated.suggestedImagePrompt);
          imageUrl = imgResult.url;
        } catch (imgErr) {
          console.warn(`[BatchGenerate] Image generation failed for slot ${slot.scheduledAt.toISOString()}:`, imgErr);
          imageGenerationFailed = true;
        }
      }

      results.push({
        content: generated.content,
        contentType: generated.contentType,
        scheduledAt: slot.scheduledAt,
        suggestedImagePrompt: generated.suggestedImagePrompt,
        overlayHeadline: generated.overlayHeadline,
        imageUrl,
        imageGenerationFailed,
      });
    } catch (err) {
      console.error(`[BatchGenerate] Failed for slot ${slot.scheduledAt.toISOString()}:`, err);
      // Push a placeholder so the caller knows this slot failed
      results.push({
        content: `[Generation failed for this slot — please regenerate manually]`,
        contentType: slot.contentType,
        scheduledAt: slot.scheduledAt,
        suggestedImagePrompt: `Professional social media graphic for ${brandName}`,
        overlayHeadline: brandName,
        imageGenerationFailed: true,
      });
    }
  }

  return results;
}

// ── Carousel Post Generator ────────────────────────────────────────────────

export interface CarouselSlide {
  headline: string;   // Short punchy headline for this slide (max ~8 words)
  body: string;       // 1-3 sentence body copy for this slide
  imagePrompt: string; // Detailed image generation prompt for this slide's visual
  imageUrl?: string;  // Filled in after image generation
}

export interface GeneratedCarousel {
  slides: CarouselSlide[];
  captionText: string;       // The main post caption (goes in the post body)
  contentType: ContentFormat;
  suggestedHashtags: string[];
}

/**
 * Generate a multi-slide carousel post using the LLM.
 * Returns 3-7 slides, each with headline, body, and image prompt.
 */
export async function generateCarouselPost(
  brandName: string,
  carouselType: "hook_solve" | "local_tips" | "machine_series" | "service_spotlight" | "custom",
  voiceSettings?: BrandVoice | null,
  customTopic?: string,
  sourceInfo?: ContentSourceInfo
): Promise<GeneratedCarousel> {
  const voiceDesc = voiceSettings
    ? `Tone: ${voiceSettings.tone}. Style: ${voiceSettings.style}. ${voiceSettings.customInstructions || ""}`
    : "Professional, direct, value-first, no fluff.";

  const avoidWords = voiceSettings?.avoidWords?.length
    ? `Never use these words/phrases: ${voiceSettings.avoidWords.join(", ")}.`
    : "";

  const topicHint = customTopic ? `Focus this carousel on: "${customTopic}".` : "";

  const serviceContext = sourceInfo?.service
    ? `\nService to feature: ${sourceInfo.service.name} — ${sourceInfo.service.description || ""}. Service areas: ${sourceInfo.service.serviceAreas?.join(", ") || ""}.`
    : "";

  const formatInstructions: Record<string, string> = {
    hook_solve: `This is a "Hook & Solve" carousel. 
Slide 1: A bold hook/problem statement that stops the scroll. Start with a relatable pain point or surprising fact.
Slides 2-5: Each slide solves one part of the problem or reveals one insight/tip. Keep each slide focused on a single idea.
Slide 6 (optional): A "So what?" or "Key takeaway" summary slide.
Last slide: A clear, low-friction CTA. Example: "Questions? DM us or call — answers don't cost anything."`,

    local_tips: `This is a "Local Business Tips" carousel for businesses in the service area.
Slide 1: Hook — a local business challenge or opportunity.
Slides 2-4: Practical, actionable tips specific to local businesses.
Slide 5: How ${brandName} helps with this.
Last slide: CTA.`,

    machine_series: `This is a "Your Website Is a Machine" carousel.
Slide 1: Hook — most websites are broken machines (or a specific symptom).
Slides 2-4: What a high-performing website actually does (each slide = one function).
Slide 5: What to audit or fix first.
Last slide: CTA — offer a free audit or consultation.`,

    service_spotlight: `This is a "Service Spotlight" carousel.${serviceContext}
Slide 1: Hook — the problem this service solves.
Slides 2-4: How the service works, what makes it different, results/outcomes.
Slide 5: Social proof or specific result.
Last slide: CTA.`,

    custom: `Create a valuable, educational carousel with 4-6 slides.
Slide 1: A compelling hook.
Middle slides: Deliver the value — tips, insights, or a story.
Last slide: CTA.`,
  };

  const instructions = formatInstructions[carouselType as string] || formatInstructions.custom;

  const systemPrompt = `You are a social media content strategist for ${brandName}.
Brand voice: ${voiceDesc}
${avoidWords}
${topicHint}

You create carousel posts for Instagram and Facebook. Each slide must be concise, visually distinct, and build on the previous one.

CRITICAL RULES:
- Each slide headline: max 8 words, punchy, no filler
- Each slide body: 1-3 sentences max, conversational, no corporate speak
- Image prompts: describe a professional, brand-appropriate visual — NO text in images, NO stock photo clichés
- The caption text is what appears BELOW the carousel on the feed — make it engaging and include hashtags at the end
- Return ONLY valid JSON matching the schema exactly`;

  const userPrompt = `${instructions}

Return a JSON object with this exact structure:
{
  "slides": [
    {
      "headline": "Short punchy headline",
      "body": "1-3 sentences of value-packed copy.",
      "imagePrompt": "Detailed visual description for AI image generation. No text in image."
    }
  ],
  "captionText": "The main post caption that appears below the carousel. Engaging opener + context + hashtags.",
  "suggestedHashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

Generate 4-6 slides. Make each slide feel like it earns the swipe.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "carousel_post",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  body: { type: "string" },
                  imagePrompt: { type: "string" },
                },
                required: ["headline", "body", "imagePrompt"],
                additionalProperties: false,
              },
            },
            captionText: { type: "string" },
            suggestedHashtags: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["slides", "captionText", "suggestedHashtags"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response for carousel");
  const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  const parsed = JSON.parse(raw) as {
    slides: Array<{ headline: string; body: string; imagePrompt: string }>;
    captionText: string;
    suggestedHashtags: string[];
  };

  return {
    slides: parsed.slides,
    captionText: parsed.captionText,
    contentType: carouselType,
    suggestedHashtags: parsed.suggestedHashtags,
  };
}
