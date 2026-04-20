/**
 * Image generation using OpenAI gpt-image-1
 *
 * Generates background images (no text) for social media posts.
 * Text is overlaid separately by the imageOverlay service to avoid
 * AI-generated text misspellings.
 *
 * Example usage:
 *   const { url } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high";
};

export type GenerateImageResponse = {
  url?: string;
  base64?: string; // raw base64 PNG data for embedding in SVGs
};

/**
 * Sanitize the prompt to prevent the model from rendering text in the image.
 * Appends explicit instructions to avoid any text, letters, or words.
 */
function sanitizePrompt(prompt: string): string {
  // Remove any explicit text rendering instructions from the original prompt
  const cleaned = prompt
    .replace(/\b(with text|with words|with letters|saying|that says|with the text|no text[^.]*)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // One concise no-text instruction at the end
  return `${cleaned}. No text, letters, or watermarks in the image.`;
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const sanitizedPrompt = sanitizePrompt(options.prompt);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: sanitizedPrompt,
      n: 1,
      size: options.size || "1024x1024",
      quality: options.quality || "medium",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Image generation failed (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  const result = await response.json() as {
    data: Array<{ b64_json: string; revised_prompt?: string }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("Image generation returned no image data");
  }

  const base64Data = result.data[0].b64_json;
  const buffer = Buffer.from(base64Data, "base64");

  // Upload to R2 storage
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );

  return { url, base64: base64Data };
}
