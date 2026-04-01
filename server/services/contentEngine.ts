/**
 * AI Content Engine for generating social media posts in brand voice.
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
  | "custom";

export interface BrandVoice {
  tone: string;
  style: string;
  keywords: string[];
  avoidWords: string[];
  samplePosts: string[];
  customInstructions: string;
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

  custom: `Create a professional, engaging social media post. Make it informative and actionable with a clear call-to-action.`,
};

/**
 * Generate a social media post using AI in the brand's voice
 */
export async function generatePost(
  brandName: string,
  contentType: ContentFormat,
  voiceSettings?: BrandVoice | null,
  customTopic?: string
): Promise<GeneratedContent> {
  const formatPrompt = FORMAT_PROMPTS[contentType];

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

  const systemPrompt = `You are a social media content strategist for ${brandName}. You create engaging, professional posts that drive engagement and build authority. Your posts should sound authentically human — NOT like AI generated content. Be direct, conversational, and value-driven.

${voiceInstructions}

Important rules:
- Keep posts under 2000 characters for optimal engagement
- Use line breaks for readability
- Include relevant hashtags (3-5 max)
- Include emojis sparingly and strategically
- End with a clear, low-friction call-to-action
- The post must be ready to publish as-is`;

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
    contentType,
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
