/**
 * Smart Image Generation — Programmatic Text Overlay Engine
 *
 * Generates social media graphics by:
 * 1. Taking an AI-generated background image (no text)
 * 2. Compositing clean text layers on top (headline, CTA, brand name, hashtags)
 * 3. Returning the final composite image uploaded to S3
 *
 * Uses HTML Canvas rendered server-side for text overlay.
 * Falls back to gradient-based template graphics when AI background fails.
 */

import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export interface OverlayConfig {
  backgroundUrl: string;
  headline: string;
  subtext: string;
  ctaText: string;
  brandName: string;
  hashtags: string[];
  style: "modern" | "bold" | "minimal" | "vibrant" | "dark";
  brandLogoUrl: string;
}

export interface OverlayResult {
  imageUrl: string;
  width: number;
  height: number;
}

// Style configurations
const STYLE_CONFIGS = {
  modern: {
    bgGradient: ["#0a1628", "#1a2744"],
    accentColor: "#00d4ff",
    headlineColor: "#ffffff",
    subtextColor: "#b0c4de",
    ctaBg: "#00d4ff",
    ctaText: "#0a1628",
    fontFamily: "Arial, sans-serif",
    overlayOpacity: 0.7,
  },
  bold: {
    bgGradient: ["#1a0a2e", "#3d1a78"],
    accentColor: "#ff6b35",
    headlineColor: "#ffffff",
    subtextColor: "#d4c5f9",
    ctaBg: "#ff6b35",
    ctaText: "#ffffff",
    fontFamily: "Arial Black, sans-serif",
    overlayOpacity: 0.75,
  },
  minimal: {
    bgGradient: ["#f8f9fa", "#e9ecef"],
    accentColor: "#2563eb",
    headlineColor: "#1a1a2e",
    subtextColor: "#6b7280",
    ctaBg: "#2563eb",
    ctaText: "#ffffff",
    fontFamily: "Helvetica, Arial, sans-serif",
    overlayOpacity: 0.85,
  },
  vibrant: {
    bgGradient: ["#0f172a", "#1e3a5f"],
    accentColor: "#22d3ee",
    headlineColor: "#ffffff",
    subtextColor: "#94a3b8",
    ctaBg: "#22d3ee",
    ctaText: "#0f172a",
    fontFamily: "Arial, sans-serif",
    overlayOpacity: 0.65,
  },
  dark: {
    bgGradient: ["#000000", "#1a1a2e"],
    accentColor: "#00d4ff",
    headlineColor: "#ffffff",
    subtextColor: "#9ca3af",
    ctaBg: "#00d4ff",
    ctaText: "#000000",
    fontFamily: "Arial, sans-serif",
    overlayOpacity: 0.8,
  },
};

/**
 * Generate SVG-based social media graphic with text overlay.
 * This approach works server-side without canvas dependencies.
 */
export function generateOverlaySVG(config: OverlayConfig): string {
  const width = 1080;
  const height = 1080;
  const style = STYLE_CONFIGS[config.style] || STYLE_CONFIGS.modern;
  const padding = 60;

  // Escape XML special characters
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background gradient
  svg += `<defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${style.bgGradient[0]}" />
      <stop offset="100%" style="stop-color:${style.bgGradient[1]}" />
    </linearGradient>
  </defs>`;
  svg += `<rect width="${width}" height="${height}" fill="url(#bg)" />`;

  // If we have a background image, overlay it
  if (config.backgroundUrl) {
    svg += `<image href="${esc(config.backgroundUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`;
    // Dark overlay for text readability
    svg += `<rect width="${width}" height="${height}" fill="rgba(0,0,0,${style.overlayOpacity})" />`;
  }

  // Accent line at top
  svg += `<rect x="${padding}" y="${padding}" width="80" height="4" fill="${style.accentColor}" rx="2" />`;

  let yPos = padding + 50;

  // Brand name (small, top)
  if (config.brandName) {
    svg += `<text x="${padding}" y="${yPos}" fill="${style.accentColor}" font-family="${style.fontFamily}" font-size="22" font-weight="600" letter-spacing="2">${esc(config.brandName.toUpperCase())}</text>`;
    yPos += 60;
  }

  // Headline (large, main text)
  if (config.headline) {
    const words = config.headline.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    const maxCharsPerLine = config.style === "bold" ? 18 : 22;

    for (const word of words) {
      if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = (currentLine + " " + word).trim();
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    const fontSize = config.style === "bold" ? 56 : 48;
    const lineHeight = fontSize * 1.3;

    for (const line of lines) {
      svg += `<text x="${padding}" y="${yPos}" fill="${style.headlineColor}" font-family="${style.fontFamily}" font-size="${fontSize}" font-weight="700">${esc(line)}</text>`;
      yPos += lineHeight;
    }
    yPos += 20;
  }

  // Subtext
  if (config.subtext) {
    const words = config.subtext.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    const maxCharsPerLine = 40;

    for (const word of words) {
      if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = (currentLine + " " + word).trim();
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    for (const line of lines) {
      svg += `<text x="${padding}" y="${yPos}" fill="${style.subtextColor}" font-family="${style.fontFamily}" font-size="24" font-weight="400">${esc(line)}</text>`;
      yPos += 34;
    }
    yPos += 30;
  }

  // CTA button
  if (config.ctaText) {
    const ctaWidth = Math.max(config.ctaText.length * 16 + 40, 200);
    const ctaHeight = 52;
    const ctaY = Math.max(yPos, height - 200);
    svg += `<rect x="${padding}" y="${ctaY}" width="${ctaWidth}" height="${ctaHeight}" fill="${style.ctaBg}" rx="8" />`;
    svg += `<text x="${padding + ctaWidth / 2}" y="${ctaY + 34}" fill="${style.ctaText}" font-family="${style.fontFamily}" font-size="20" font-weight="700" text-anchor="middle">${esc(config.ctaText)}</text>`;
    yPos = ctaY + ctaHeight + 20;
  }

  // Hashtags at bottom
  if (config.hashtags && config.hashtags.length > 0) {
    const hashtagText = config.hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join("  ");
    const hashY = Math.max(yPos + 10, height - 80);
    svg += `<text x="${padding}" y="${hashY}" fill="${style.accentColor}" font-family="${style.fontFamily}" font-size="18" font-weight="500" opacity="0.8">${esc(hashtagText)}</text>`;
  }

  // Bottom accent line
  svg += `<rect x="${padding}" y="${height - padding}" width="${width - padding * 2}" height="2" fill="${style.accentColor}" opacity="0.3" />`;

  svg += `</svg>`;
  return svg;
}

/**
 * Generate and upload a smart image with text overlay.
 * Returns the CDN URL of the final composite image.
 */
export async function generateSmartImage(config: OverlayConfig): Promise<OverlayResult> {
  const svg = generateOverlaySVG(config);
  const svgBuffer = Buffer.from(svg, "utf-8");

  // Upload SVG to S3 (SVG is widely supported for social media previews)
  const fileKey = `smart-images/${nanoid()}.svg`;
  const { url } = await storagePut(fileKey, svgBuffer, "image/svg+xml");

  return {
    imageUrl: url,
    width: 1080,
    height: 1080,
  };
}

/**
 * Generate a template-based fallback graphic (no AI needed).
 * Used when AI image generation fails or for specific post types.
 */
export async function generateTemplateGraphic(
  brandName: string,
  headline: string,
  style: "modern" | "bold" | "minimal" | "vibrant" | "dark" = "modern",
  ctaText?: string,
  hashtags?: string[]
): Promise<OverlayResult> {
  return generateSmartImage({
    backgroundUrl: "", // No background — uses gradient only
    headline,
    subtext: "",
    ctaText: ctaText || "",
    brandName,
    hashtags: hashtags || [],
    style,
    brandLogoUrl: "",
  });
}
