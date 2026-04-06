/**
 * CarouselBuilder
 * Full slide builder for creating multi-slide carousel posts.
 * Supports per-slide copy editing, per-slide image generation, drag-to-reorder,
 * and saving as draft or scheduled post.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Sparkles, Save, Image as ImageIcon, ChevronLeft, ChevronRight,
  Plus, Trash2, RefreshCw, Copy, Check, GripVertical, CalendarDays, Layers
} from "lucide-react";
import { toast } from "sonner";
import { MediaUploadButton } from "@/components/MediaUploadButton";

interface Slide {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl?: string;
}

interface Props {
  brandId: number;
  brandName: string;
}

const CAROUSEL_TYPES = [
  { value: "hook_solve", label: "Hook & Solve" },
  { value: "local_tips", label: "Local Business Tips" },
  { value: "machine_series", label: "Your Website Is a Machine" },
  { value: "service_spotlight", label: "Service Spotlight" },
  { value: "custom", label: "Custom Carousel" },
] as const;

export default function CarouselBuilder({ brandId, brandName }: Props) {
  const [carouselType, setCarouselType] = useState<"hook_solve" | "local_tips" | "machine_series" | "service_spotlight" | "custom">("hook_solve");
  const [customTopic, setCustomTopic] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [captionText, setCaptionText] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saveStatus, setSaveStatus] = useState<"draft" | "scheduled">("draft");
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCarousel = trpc.ai.generateCarousel.useMutation({
    onSuccess: (data) => {
      setSlides(data.slides);
      setCaptionText(data.captionText);
      setActiveSlide(0);
      toast.success(`Generated ${data.slides.length} slides`);
    },
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });

  const generateImage = trpc.ai.generateImage.useMutation({
    onError: (e) => toast.error(`Image failed: ${e.message}`),
  });

  const saveCarousel = trpc.ai.saveCarousel.useMutation({
    onSuccess: () => {
      toast.success(`Carousel saved as ${saveStatus}`);
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const handleGenerate = () => {
    generateCarousel.mutate({ brandId, carouselType, customTopic: customTopic || undefined });
  };

  const handleGenerateSlideImage = async (index: number) => {
    const slide = slides[index];
    if (!slide) return;
    setGeneratingImageFor(index);
    try {
      const result = await generateImage.mutateAsync({
        prompt: `${slide.imagePrompt}. No text, no words, no letters. Professional social media visual for ${brandName}.`,
      });
      const updated = [...slides];
      updated[index] = { ...updated[index], imageUrl: result.imageUrl };
      setSlides(updated);
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const handleGenerateAllImages = async () => {
    for (let i = 0; i < slides.length; i++) {
      await handleGenerateSlideImage(i);
    }
    toast.success("All slide images generated");
  };

  const handleSlideChange = (index: number, field: keyof Slide, value: string) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], [field]: value };
    setSlides(updated);
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      headline: "New Slide",
      body: "Add your content here.",
      imagePrompt: `Professional social media visual for ${brandName}`,
    };
    const updated = [...slides, newSlide];
    setSlides(updated);
    setActiveSlide(updated.length - 1);
  };

  const handleRemoveSlide = (index: number) => {
    if (slides.length <= 2) {
      toast.error("Carousels need at least 2 slides");
      return;
    }
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    setActiveSlide(Math.min(activeSlide, updated.length - 1));
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    const updated = [...slides];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSlides(updated);
    setActiveSlide(newIndex);
  };

  const handleSave = () => {
    if (slides.length < 2) {
      toast.error("Need at least 2 slides to save a carousel");
      return;
    }
    saveCarousel.mutate({
      brandId,
      captionText,
      contentType: carouselType,
      slides,
      scheduledAt: scheduledAt || undefined,
      status: saveStatus,
      platforms: ["facebook", "instagram"],
    });
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentSlide = slides[activeSlide];
  const hasSlides = slides.length > 0;

  return (
    <div className="space-y-6">
      {/* Generator Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Carousel Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Carousel Type</Label>
              <Select value={carouselType} onValueChange={(v) => setCarouselType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAROUSEL_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic (optional)</Label>
              <Input
                placeholder="e.g., Google Business Profile reviews"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generateCarousel.isPending}
            className="w-full gap-2"
          >
            {generateCarousel.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generating slides...</>
            ) : (
              <><Sparkles className="h-4 w-4" />{hasSlides ? "Regenerate Carousel" : "Generate Carousel"}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {hasSlides && (
        <>
          {/* Slide Navigator */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  i === activeSlide
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                Slide {i + 1}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSlide}
              className="shrink-0 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>

          {/* Active Slide Editor */}
          {currentSlide && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Slide {activeSlide + 1} of {slides.length}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveSlide(activeSlide, "up")}
                      disabled={activeSlide === 0}
                      title="Move left"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveSlide(activeSlide, "down")}
                      disabled={activeSlide === slides.length - 1}
                      title="Move right"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveSlide(activeSlide)}
                      title="Remove slide"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Left: Copy Editor */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Headline</Label>
                      <Input
                        value={currentSlide.headline}
                        onChange={(e) => handleSlideChange(activeSlide, "headline", e.target.value)}
                        placeholder="Short punchy headline..."
                        className="font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Body Copy</Label>
                      <Textarea
                        value={currentSlide.body}
                        onChange={(e) => handleSlideChange(activeSlide, "body", e.target.value)}
                        placeholder="1-3 sentences of value..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Image Prompt</Label>
                      <Textarea
                        value={currentSlide.imagePrompt}
                        onChange={(e) => handleSlideChange(activeSlide, "imagePrompt", e.target.value)}
                        placeholder="Describe the visual for this slide..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  {/* Right: Image Preview */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Slide Image</Label>
                    {currentSlide.imageUrl ? (
                      <div className="relative group">
                        <img
                          src={currentSlide.imageUrl}
                          alt={`Slide ${activeSlide + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-border"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1 text-xs"
                          onClick={() => handleGenerateSlideImage(activeSlide)}
                          disabled={generatingImageFor === activeSlide}
                        >
                          {generatingImageFor === activeSlide ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 bg-secondary/20">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateSlideImage(activeSlide)}
                          disabled={generatingImageFor === activeSlide}
                          className="gap-2"
                        >
                          {generatingImageFor === activeSlide ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
                          ) : (
                            <><Sparkles className="h-3.5 w-3.5" />Generate Image</>
                          )}
                        </Button>
                      </div>
                    )}
                    <MediaUploadButton
                      compact
                      onUploadComplete={(url) => handleSlideChange(activeSlide, "imageUrl", url)}
                      currentUrl={currentSlide.imageUrl}
                      allowVideo={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Caption Editor */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Post Caption</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCaption}
                  className="gap-1.5 text-xs h-7"
                >
                  {copied ? <><Check className="h-3 w-3 text-green-400" />Copied</> : <><Copy className="h-3 w-3" />Copy</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                rows={5}
                placeholder="The main caption that appears below the carousel..."
              />
            </CardContent>
          </Card>

          {/* Bulk Image Generation */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">
              {slides.filter(s => s.imageUrl).length} of {slides.length} slides have images.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAllImages}
              disabled={generatingImageFor !== null}
              className="gap-2 text-xs shrink-0"
            >
              {generatingImageFor !== null ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" />Generate All Images</>
              )}
            </Button>
          </div>

          {/* Save Controls */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Save as</Label>
                  <Select value={saveStatus} onValueChange={(v) => setSaveStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {saveStatus === "scheduled" && (
                  <div className="space-y-2">
                    <Label>Schedule Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={saveCarousel.isPending || slides.length < 2}
                className="w-full gap-2"
              >
                {saveCarousel.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4" />Save Carousel ({slides.length} slides)</>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
