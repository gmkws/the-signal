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
}

const FORMAT_PROMPTS: Record<ContentFormat, string> = {
  hey_tony: `Create a "Hey Tony" value-first tip post. This format leads with an actionable golden nugget of information — a specific SEO fix, AI tip, or website mistake that business owners can immediately use. The tone should be generous with knowledge, proving value by showing it, not just talking about it. Start with a hook that grabs attention, then deliver the tip clearly. End with a low-friction CTA like "Have questions? DM or call — answers don't cost anything."`,

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
            imagePrompt: {
              type: "string",
              description: "A detailed prompt for generating an accompanying image. Should describe a professional, modern visual that complements the post content. Use a dark navy/tech blue color scheme.",
            },
          },
          required: ["postContent", "imagePrompt"],
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
  };
}

/**
 * Generate an image for a social media post
 */
export async function generatePostImage(prompt: string): Promise<string> {
  const enhancedPrompt = `Professional social media post image. Modern, clean design with dark navy blue background and cyan/teal accents. ${prompt}. High quality, suitable for Facebook and Instagram. No text overlay.`;

  const result = await generateImage({ prompt: enhancedPrompt });
  if (!result.url) throw new Error("Image generation returned no URL");
  return result.url;
}
