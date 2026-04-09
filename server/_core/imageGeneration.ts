/**
 * Image generation using OpenAI DALL-E 3
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
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
};

export type GenerateImageResponse = {
  url?: string;
};

/**
 * Sanitize the prompt to prevent DALL-E from rendering text in the image.
 * Appends explicit instructions to avoid any text, letters, or words.
 */
function sanitizePrompt(prompt: string): string {
  const noTextSuffix = ". IMPORTANT: Do not include any text, words, letters, numbers, watermarks, or typography in the image. The image should be purely visual with no written content whatsoever.";
  // Remove any explicit text rendering instructions from the original prompt
  const cleaned = prompt
    .replace(/\b(with text|with words|with letters|saying|that says|with the text)\b/gi, "")
    .trim();
  return cleaned + noTextSuffix;
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
      model: "dall-e-3",
      prompt: sanitizedPrompt,
      n: 1,
      size: options.size || "1024x1024",
      quality: options.quality || "standard",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `DALL-E image generation failed (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  const result = await response.json() as {
    data: Array<{ b64_json: string; revised_prompt?: string }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("DALL-E returned no image data");
  }

  const base64Data = result.data[0].b64_json;
  const buffer = Buffer.from(base64Data, "base64");

  // Upload to R2 storage
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );

  return { url };
}
