import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Instagram, Facebook, AlertCircle, CheckCircle2, Hash } from "lucide-react";

// Platform character limits
const FB_LIMIT = 63206;
const IG_LIMIT = 2200;
const IG_HASHTAG_LIMIT = 30;
const IG_CAPTION_PREVIEW = 125; // chars shown before "more"

interface CarouselSlide {
  headline: string;
  body: string;
  imageUrl?: string;
}

interface PostPreviewPanelProps {
  content: string;
  imageUrl?: string;
  isCarousel?: boolean;
  carouselSlides?: CarouselSlide[];
  brandName?: string;
  brandAvatarUrl?: string;
}

function extractHashtags(text: string): string[] {
  return (text.match(/#\w+/g) ?? []);
}

function formatForDisplay(text: string): React.ReactNode {
  // Split on hashtags and URLs for colored rendering.
  // Key uses content + index so React can diff correctly without blowing away
  // DOM nodes when the part count changes (avoids focus loss in parent inputs).
  const parts = text.split(/(#\w+|https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    const key = `${i}:${part}`;
    if (part.startsWith("#")) {
      return <span key={key} className="text-blue-400">{part}</span>;
    }
    if (part.startsWith("http")) {
      return <span key={key} className="text-blue-400 underline">{part}</span>;
    }
    return <span key={key}>{part}</span>;
  });
}

function CharacterCount({ text, limit, label }: { text: string; limit: number; label: string }) {
  const count = text.length;
  const remaining = limit - count;
  const pct = Math.min(count / limit, 1);
  const isOver = count > limit;
  const isWarning = remaining < 100 && !isOver;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={isOver ? "text-red-400 font-medium" : isWarning ? "text-yellow-400" : "text-muted-foreground"}>
        {count.toLocaleString()} / {limit.toLocaleString()}
      </span>
      {isOver && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
      {!isOver && count > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-green-500/60" />}
    </div>
  );
}

function InstagramPreview({
  content,
  imageUrl,
  brandName,
  brandAvatarUrl,
}: {
  content: string;
  imageUrl?: string;
  brandName?: string;
  brandAvatarUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hashtags = extractHashtags(content);
  const hashtagCount = hashtags.length;
  const isOver = hashtagCount > IG_HASHTAG_LIMIT;
  const isCaptionOver = content.length > IG_LIMIT;
  const shortCaption = content.length > IG_CAPTION_PREVIEW && !expanded;

  return (
    <div className="bg-black rounded-2xl overflow-hidden w-full max-w-[375px] mx-auto border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {brandAvatarUrl ? (
            <img src={brandAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            (brandName?.[0] ?? "B").toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="text-white text-xs font-semibold leading-none">{brandName ?? "your_brand"}</p>
          <p className="text-white/50 text-[10px] mt-0.5">Sponsored</p>
        </div>
        <span className="text-white/60 text-lg leading-none">···</span>
      </div>

      {/* Image area */}
      <div className="w-full aspect-square bg-zinc-900 flex items-center justify-center relative">
        {imageUrl ? (
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/20">
            <Instagram className="h-10 w-10" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-2 flex items-center gap-4 bg-black">
        <span className="text-white text-xl">♡</span>
        <span className="text-white text-xl">💬</span>
        <span className="text-white text-xl">↗</span>
        <span className="ml-auto text-white text-xl">🔖</span>
      </div>

      {/* Caption */}
      <div className="px-4 pb-4 bg-black">
        <p className="text-white text-xs leading-relaxed">
          <span className="font-semibold">{brandName ?? "your_brand"} </span>
          {shortCaption ? (
            <>
              {formatForDisplay(content.slice(0, IG_CAPTION_PREVIEW))}
              <span className="text-white/50">... </span>
              <button onClick={() => setExpanded(true)} className="text-white/50 text-xs">more</button>
            </>
          ) : (
            formatForDisplay(content)
          )}
        </p>
        {hashtagCount > 0 && (
          <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${isOver ? "text-red-400" : "text-white/40"}`}>
            <Hash className="h-3 w-3" />
            <span>{hashtagCount} hashtag{hashtagCount !== 1 ? "s" : ""}</span>
            {isOver && <span className="text-red-400">(max {IG_HASHTAG_LIMIT})</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function InstagramCarouselPreview({
  slides,
  brandName,
  brandAvatarUrl,
}: {
  slides: CarouselSlide[];
  brandName?: string;
  brandAvatarUrl?: string;
}) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  return (
    <div className="bg-black rounded-2xl overflow-hidden w-full max-w-[375px] mx-auto border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {(brandName?.[0] ?? "B").toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-white text-xs font-semibold">{brandName ?? "your_brand"}</p>
        </div>
        <span className="text-white/40 text-xs">{current + 1}/{slides.length}</span>
      </div>

      {/* Slide image */}
      <div className="w-full aspect-square bg-zinc-900 flex items-center justify-center relative">
        {slide?.imageUrl ? (
          <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-white font-bold text-lg leading-tight">{slide?.headline}</p>
            <p className="text-white/70 text-sm leading-relaxed">{slide?.body}</p>
          </div>
        )}
        {/* Nav arrows */}
        {current > 0 && (
          <button
            onClick={() => setCurrent(c => c - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
        )}
        {current < slides.length - 1 && (
          <button
            onClick={() => setCurrent(c => c + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 py-2 bg-black">
        {slides.map((slide, i) => (
          <button
            key={`dot-${i}-${slide.headline}`}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? "w-4 bg-blue-400" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>

      {/* Caption */}
      <div className="px-4 pb-4 bg-black">
        <p className="text-white text-xs leading-relaxed">
          <span className="font-semibold">{brandName ?? "your_brand"} </span>
          {formatForDisplay(slide?.body ?? "")}
        </p>
      </div>
    </div>
  );
}

function FacebookPreview({
  content,
  imageUrl,
  brandName,
  brandAvatarUrl,
}: {
  content: string;
  imageUrl?: string;
  brandName?: string;
  brandAvatarUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LEN = 200;
  const shortCaption = content.length > PREVIEW_LEN && !expanded;

  return (
    <div className="bg-[#242526] rounded-xl overflow-hidden w-full max-w-[400px] mx-auto border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {brandAvatarUrl ? (
            <img src={brandAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            (brandName?.[0] ?? "B").toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-semibold leading-none">{brandName ?? "Your Brand"}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-white/50 text-xs">Just now</span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/50 text-xs">🌐</span>
          </div>
        </div>
        <span className="text-white/60 text-lg">···</span>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-white text-sm leading-relaxed">
          {shortCaption ? (
            <>
              {formatForDisplay(content.slice(0, PREVIEW_LEN))}
              <span className="text-white/50">... </span>
              <button onClick={() => setExpanded(true)} className="text-blue-400 text-sm">See more</button>
            </>
          ) : (
            formatForDisplay(content)
          )}
        </p>
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        </div>
      )}
      {!imageUrl && (
        <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/20">
            <Facebook className="h-10 w-10" />
            <span className="text-xs">No image</span>
          </div>
        </div>
      )}

      {/* Engagement row */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-white/10">
        <span className="text-white/50 text-xs">👍 Like · 💬 Comment · ↗ Share</span>
      </div>
    </div>
  );
}

function FacebookCarouselPreview({
  slides,
  brandName,
}: {
  slides: CarouselSlide[];
  brandName?: string;
}) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  return (
    <div className="bg-[#242526] rounded-xl overflow-hidden w-full max-w-[400px] mx-auto border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {(brandName?.[0] ?? "B").toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-semibold">{brandName ?? "Your Brand"}</p>
          <p className="text-white/50 text-xs mt-0.5">Just now · 🌐</p>
        </div>
      </div>

      {/* Slide */}
      <div className="relative">
        <div className="w-full aspect-square bg-zinc-800 flex items-center justify-center">
          {slide?.imageUrl ? (
            <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="p-6 text-center">
              <p className="text-white font-bold text-base mb-2">{slide?.headline}</p>
              <p className="text-white/70 text-sm">{slide?.body}</p>
            </div>
          )}
        </div>
        {current > 0 && (
          <button
            onClick={() => setCurrent(c => c - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
        )}
        {current < slides.length - 1 && (
          <button
            onClick={() => setCurrent(c => c + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      {/* Slide title bar */}
      <div className="px-4 py-2 bg-zinc-800 border-t border-white/10 flex items-center justify-between">
        <p className="text-white text-xs font-medium truncate">{slide?.headline}</p>
        <span className="text-white/40 text-xs shrink-0 ml-2">{current + 1}/{slides.length}</span>
      </div>

      <div className="px-4 py-2 flex items-center justify-between border-t border-white/10">
        <span className="text-white/50 text-xs">👍 Like · 💬 Comment · ↗ Share</span>
      </div>
    </div>
  );
}

export function PostPreviewPanel({
  content,
  imageUrl,
  isCarousel = false,
  carouselSlides = [],
  brandName,
  brandAvatarUrl,
}: PostPreviewPanelProps) {
  const hashtags = extractHashtags(content);

  return (
    <div className="space-y-4">
      {/* Character count summary */}
      <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-muted/30 border">
        <CharacterCount text={content} limit={IG_LIMIT} label="Instagram" />
        <CharacterCount text={content} limit={FB_LIMIT} label="Facebook" />
        {hashtags.length > 0 && (
          <div className={`flex items-center gap-1.5 text-xs ${hashtags.length > IG_HASHTAG_LIMIT ? "text-red-400" : "text-muted-foreground"}`}>
            <Hash className="h-3.5 w-3.5" />
            <span>{hashtags.length} hashtag{hashtags.length !== 1 ? "s" : ""}</span>
            {hashtags.length > IG_HASHTAG_LIMIT && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1">Over IG limit</Badge>
            )}
          </div>
        )}
      </div>

      {/* Platform previews */}
      <Tabs defaultValue="instagram">
        <TabsList className="w-full">
          <TabsTrigger value="instagram" className="flex-1 flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex-1 flex items-center gap-2">
            <Facebook className="h-4 w-4" />
            Facebook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instagram" className="mt-4">
          {isCarousel && carouselSlides.length > 0 ? (
            <InstagramCarouselPreview
              slides={carouselSlides}
              brandName={brandName}
              brandAvatarUrl={brandAvatarUrl}
            />
          ) : (
            <InstagramPreview
              content={content}
              imageUrl={imageUrl}
              brandName={brandName}
              brandAvatarUrl={brandAvatarUrl}
            />
          )}
        </TabsContent>

        <TabsContent value="facebook" className="mt-4">
          {isCarousel && carouselSlides.length > 0 ? (
            <FacebookCarouselPreview
              slides={carouselSlides}
              brandName={brandName}
            />
          ) : (
            <FacebookPreview
              content={content}
              imageUrl={imageUrl}
              brandName={brandName}
              brandAvatarUrl={brandAvatarUrl}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
