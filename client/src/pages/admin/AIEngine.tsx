import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Sparkles, Image as ImageIcon, Copy, Check, Save, Loader2, ShoppingBag, Wrench, Info, Layers, Type, RefreshCw, Lightbulb, CalendarDays, LayoutGrid, Upload, Camera } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useCallback } from "react";
import FillScheduleModal from "@/components/FillScheduleModal";
import { PostPreviewPanel } from "@/components/PostPreviewPanel";
import CarouselBuilder from "@/components/CarouselBuilder";
import { MediaUploadButton } from "@/components/MediaUploadButton";
import { toast } from "sonner";
import { CONTENT_TYPE_LABELS } from "@shared/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Defined outside the component so it is never re-created on re-renders.
// Placing a plain function inside a component body is not itself a focus bug,
// but it does generate a new function reference every render — keeping it at
// module scope is the cleanest pattern.
function contentTypeDescription(ct: string): string {
  switch (ct) {
    case "hey_tony": return "Value-first tips — website, AI, branding, local business";
    case "hook_solve": return "Problem → Solution format with visual hooks";
    case "auditor_showcase": return "Before/after site audit showcases";
    case "local_tips": return "Hillsboro/Washington County business tips";
    case "machine_series": return "\"Your website is a machine\" educational series";
    case "print_digital": return "Print + digital full-stack capability highlights";
    case "shopify_product": return "Product spotlight from connected Shopify store";
    case "service_spotlight": return "Service highlight with seasonal reminders and CTAs";
    case "custom": return "Custom post with your own topic";
    default: return "";
  }
}

export default function AdminAI() {
  const utils = trpc.useUtils();
  const { data: brands } = trpc.brand.list.useQuery();

  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [contentType, setContentType] = useState<string>("hey_tony");
  const [customTopic, setCustomTopic] = useState("");
  // Hey Tony-specific topic override
  const [heyTonyTopic, setHeyTonyTopic] = useState("");
  const [useContentSources, setUseContentSources] = useState(true);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedContentType, setGeneratedContentType] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [smartImageUrl, setSmartImageUrl] = useState("");
  const [overlayHeadline, setOverlayHeadline] = useState("");
  const [overlayCta, setOverlayCta] = useState("");
  const [overlayHashtags, setOverlayHashtags] = useState("");
  const [imageMode, setImageMode] = useState<"ai" | "smart">("smart");
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");
  // Copy-to-clipboard feedback state
  const [copied, setCopied] = useState(false);
  // Fill Schedule modal
  const [fillScheduleOpen, setFillScheduleOpen] = useState(false);

  // Case Study state
  const [csServiceType, setCsServiceType] = useState("Custom Fabrication");
  const [csBeforeFile, setCsBeforeFile] = useState<{ base64: string; url: string } | null>(null);
  const [csAfterFile, setCsAfterFile] = useState<{ base64: string; url: string } | null>(null);
  const [csGenerated, setCsGenerated] = useState("");
  const [csCopied, setCsCopied] = useState(false);

  const brandId = selectedBrand ? parseInt(selectedBrand) : undefined;

  // Check content sources for selected brand
  const { data: shopifyConn } = trpc.shopify.getConnection.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );
  const { data: services } = trpc.service.list.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );

  const hasShopify = !!shopifyConn;
  const hasServices = (services?.length || 0) > 0;

  const generatePost = trpc.ai.generatePost.useMutation({
    onSuccess: async (data) => {
      setGeneratedContent(data.content);
      setImagePrompt(data.suggestedImagePrompt);
      setGeneratedContentType(data.contentType);
      if (data.overlayHeadline) {
        setOverlayHeadline(data.overlayHeadline);
      }
      toast.success("Content generated!");

      // Auto-generate image if AI mode is selected
      if (imageSource === "ai" && data.suggestedImagePrompt) {
        const brand = brands?.find(b => b.id === parseInt(selectedBrand));
        try {
          if (imageMode === "smart") {
            const result = await generateSmartImage.mutateAsync({
              brandId: parseInt(selectedBrand),
              prompt: data.suggestedImagePrompt,
              overlayText: {
                headline: data.overlayHeadline || undefined,
                brandName: brand?.name || "GMK Web Solutions",
                hashtags: overlayHashtags ? overlayHashtags.split(" ").filter(Boolean) : undefined,
                ctaText: overlayCta || undefined,
              },
              style: "dark",
            });
            setSmartImageUrl(result.imageUrl);
          } else {
            const result = await generateImage.mutateAsync({ prompt: data.suggestedImagePrompt });
            setGeneratedImageUrl(result.imageUrl);
          }
        } catch {
          // Non-fatal — user can generate manually
        }
      }
    },
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });

  const generateImage = trpc.ai.generateImage.useMutation({
    onSuccess: (data) => {
      setGeneratedImageUrl(data.imageUrl);
      toast.success("Image generated!");
    },
    onError: (e) => toast.error(`Image generation failed: ${e.message}`),
  });

  const generateSmartImage = trpc.ai.generateSmartImage.useMutation({
    onSuccess: (data) => {
      setSmartImageUrl(data.imageUrl);
      toast.success("Smart image generated with text overlay!");
    },
    onError: (e) => toast.error(`Smart image failed: ${e.message}`),
  });

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      toast.success("Post saved as draft!");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateCaseStudy = trpc.ai.generateCaseStudy.useMutation({
    onSuccess: (data) => {
      setCsGenerated(data.content);
      toast.success("Case study caption generated!");
    },
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });

  // readImageFile is stable: only depends on the two state setters which never change.
  const readImageFile = useCallback((file: File, slot: "before" | "after") => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      const entry = { base64, url: dataUrl };
      if (slot === "before") setCsBeforeFile(entry);
      else setCsAfterFile(entry);
    };
    reader.readAsDataURL(file);
  }, []);

  // Stable drag-drop handler for the "before" slot.
  const handleCsBeforeDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    readImageFile(file, "before");
  }, [readImageFile]);

  // Stable drag-drop handler for the "after" slot.
  const handleCsAfterDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    readImageFile(file, "after");
  }, [readImageFile]);

  // Stable file-input change handlers — one per slot so they never re-create.
  const handleCsBeforePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageFile(file, "before");
  }, [readImageFile]);

  const handleCsAfterPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageFile(file, "after");
  }, [readImageFile]);

  const handleGenerateCaseStudy = () => {
    if (!selectedBrand) { toast.error("Select a brand first"); return; }
    if (!csBeforeFile) { toast.error("Upload the Before photo"); return; }
    if (!csAfterFile) { toast.error("Upload the After photo"); return; }
    generateCaseStudy.mutate({
      brandId: parseInt(selectedBrand),
      serviceType: csServiceType,
      beforeImage: csBeforeFile.base64,
      afterImage: csAfterFile.base64,
    });
  };

  const handleCsCopy = async () => {
    try {
      await navigator.clipboard.writeText(csGenerated);
      setCsCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCsCopied(false), 2000);
    } catch {
      setCsCopied(false);
    }
  };

  // Resolve the effective topic: Hey Tony uses its own field, others use customTopic
  const effectiveTopic = useCallback(() => {
    if (contentType === "hey_tony" && heyTonyTopic.trim()) return heyTonyTopic.trim();
    return customTopic.trim() || undefined;
  }, [contentType, heyTonyTopic, customTopic]);

  const handleGenerate = () => {
    if (!selectedBrand) { toast.error("Select a brand first"); return; }
    generatePost.mutate({
      brandId: parseInt(selectedBrand),
      contentType: contentType as any,
      customTopic: effectiveTopic(),
      useContentSources,
    });
  };

  // Regenerate: same settings, no form reset — just fires the mutation again
  const handleRegenerate = () => {
    if (!selectedBrand) return;
    generatePost.mutate({
      brandId: parseInt(selectedBrand),
      contentType: (generatedContentType || contentType) as any,
      customTopic: effectiveTopic(),
      useContentSources,
    });
  };

  const handleGenerateImage = () => {
    if (!imagePrompt) { toast.error("No image prompt available"); return; }
    generateImage.mutate({ prompt: imagePrompt });
  };

  const handleGenerateSmartImage = () => {
    if (!imagePrompt) { toast.error("No image prompt available"); return; }
    if (!selectedBrand) { toast.error("Select a brand first"); return; }
    const brand = brands?.find(b => b.id === parseInt(selectedBrand));
    generateSmartImage.mutate({
      brandId: parseInt(selectedBrand),
      prompt: imagePrompt,
      overlayText: {
        headline: overlayHeadline || undefined,
        ctaText: overlayCta || undefined,
        brandName: brand?.name || "GMK Web Solutions",
        hashtags: overlayHashtags ? overlayHashtags.split(" ").filter(Boolean) : undefined,
      },
      style: "dark",
    });
  };

  const handleSaveAsDraft = () => {
    if (!selectedBrand || !generatedContent) return;
    createPost.mutate({
      brandId: parseInt(selectedBrand),
      content: generatedContent,
      imageUrl: generatedImageUrl || undefined,
      contentType: (generatedContentType || contentType) as any,
      status: "draft",
      aiGenerated: true,
      platforms: ["facebook", "instagram"],
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = generatedContent;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            AI Content Engine
          </h1>
          <p className="text-muted-foreground">Generate social media content in your brand's voice</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 shrink-0"
          onClick={() => setFillScheduleOpen(true)}
          disabled={!selectedBrand}
          title={!selectedBrand ? "Select a brand first" : "Generate a full content queue"}
        >
          <CalendarDays className="h-4 w-4" />
          Fill Schedule
        </Button>
      </div>

      {/* Fill Schedule Modal */}
      {selectedBrand && (
        <FillScheduleModal
          open={fillScheduleOpen}
          onClose={() => setFillScheduleOpen(false)}
          brandId={parseInt(selectedBrand)}
          brandName={brands?.find(b => b.id === parseInt(selectedBrand))?.name ?? ""}
        />
      )}

      {/* Mode Tabs: Single Post vs Carousel */}
      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="single" className="gap-2">
            <Type className="h-4 w-4" />
            Single Post
          </TabsTrigger>
          <TabsTrigger value="carousel" className="gap-2" disabled={!selectedBrand}>
            <LayoutGrid className="h-4 w-4" />
            Carousel
          </TabsTrigger>
          <TabsTrigger value="case_study" className="gap-2">
            <Camera className="h-4 w-4" />
            Case Study
          </TabsTrigger>
        </TabsList>

        <TabsContent value="carousel">
          {selectedBrand ? (
            <CarouselBuilder
              brandId={parseInt(selectedBrand)}
              brandName={brands?.find(b => b.id === parseInt(selectedBrand))?.name ?? ""}
            />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">Select a brand above to build carousel posts</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="single">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select value={selectedBrand} onValueChange={(v) => { setSelectedBrand(v); setGeneratedContent(""); setGeneratedImageUrl(""); }}>
                <SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger>
                <SelectContent>
                  {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Content Source Indicators */}
            {selectedBrand && (
              <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Info className="h-3 w-3" /> Content Sources Detected
                </p>
                <div className="flex flex-wrap gap-2">
                  {hasShopify && (
                    <Badge variant="outline" className="text-xs gap-1 border-green-500/30 text-green-400">
                      <ShoppingBag className="h-3 w-3" /> Shopify Connected
                    </Badge>
                  )}
                  {hasServices && (
                    <Badge variant="outline" className="text-xs gap-1 border-orange-500/30 text-orange-400">
                      <Wrench className="h-3 w-3" /> {services?.length} Service{(services?.length || 0) > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {!hasShopify && !hasServices && (
                    <span className="text-xs text-muted-foreground">No Shopify or services — general brand voice only</span>
                  )}
                </div>
                {(hasShopify || hasServices) && (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={useContentSources}
                      onCheckedChange={setUseContentSources}
                      id="use-sources"
                    />
                    <Label htmlFor="use-sources" className="text-xs cursor-pointer">
                      Include product/service data in rotation
                    </Label>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Content Format</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => {
                    if (k === "shopify_product" && !hasShopify) return null;
                    if (k === "service_spotlight" && !hasServices) return null;
                    return <SelectItem key={k} value={k}>{v}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {contentTypeDescription(contentType)}
              </p>
            </div>

            {/* Hey Tony topic override — only shown when Hey Tony is selected */}
            {contentType === "hey_tony" && (
              <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  Hey Tony Topic Override
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  value={heyTonyTopic}
                  onChange={(e) => setHeyTonyTopic(e.target.value)}
                  placeholder="e.g., Google Business Profile reviews, page speed, AI follow-ups..."
                  className="text-sm h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Steer the tip toward a specific subject. Leave blank to let the AI pick from its rotation.
                </p>
              </div>
            )}

            {/* General custom topic — shown for all formats except Hey Tony */}
            {contentType !== "hey_tony" && (
              <div className="space-y-2">
                <Label>Custom Topic <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g., Why local businesses need schema markup"
                />
              </div>
            )}

            {/* Image Source Toggle */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/20">
              <Label className="text-sm font-medium">Image Source</Label>
              <RadioGroup
                value={imageSource}
                onValueChange={(v) => setImageSource(v as "ai" | "upload")}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="ai" id="ai-img-ai" />
                  <span className="text-sm flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Auto-Generate AI Image
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="upload" id="ai-img-upload" />
                  <span className="text-sm flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                    Upload Custom Image
                  </span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {imageSource === "ai"
                  ? "An AI image will be automatically generated when content is created."
                  : "No AI image will be generated. Upload your own after content is ready."}
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedBrand || generatePost.isPending || generateSmartImage.isPending || generateImage.isPending}
              className="w-full gap-2"
              size="lg"
            >
              {generatePost.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating content...</>
              ) : (generateSmartImage.isPending || generateImage.isPending) ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating image...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Content</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Content</CardTitle>
              {generatedContentType && (
                <Badge variant="outline" className="text-xs">
                  {CONTENT_TYPE_LABELS[generatedContentType as keyof typeof CONTENT_TYPE_LABELS] || generatedContentType}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedContent ? (
              <>
                <div className="relative">
                  <Textarea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    rows={10}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{generatedContent.length}/2000 characters — Edit as needed</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Copy to clipboard — shows checkmark on success */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="gap-1.5 transition-all"
                    disabled={copied}
                  >
                    {copied ? (
                      <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy</>
                    )}
                  </Button>

                  {/* Regenerate — same settings, fresh variation */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={generatePost.isPending}
                    className="gap-1.5"
                    title="Get a fresh variation with the same settings"
                  >
                    {generatePost.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating...</>
                    ) : (
                      <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAsDraft}
                    disabled={createPost.isPending}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save as Draft
                  </Button>
                </div>

                {/* Image Section — AI generation or upload zone depending on imageSource */}
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Post Image
                  </Label>

                  {imageSource === "upload" ? (
                    /* Upload-only zone */
                    <div className="space-y-2">
                      <MediaUploadButton
                        onUploadComplete={(url) => {
                          if (url) {
                            setGeneratedImageUrl(url);
                            setSmartImageUrl(url);
                          }
                        }}
                        currentUrl={smartImageUrl || generatedImageUrl || undefined}
                        allowVideo={true}
                      />
                      {(smartImageUrl || generatedImageUrl) && (
                        <div className="rounded-lg overflow-hidden border border-border">
                          <img src={smartImageUrl || generatedImageUrl} alt="Uploaded" className="w-full h-auto" />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* AI generation section */
                    <>
                      <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as any)}>
                        <TabsList className="w-full">
                          <TabsTrigger value="smart" className="flex-1 gap-1.5">
                            <Layers className="h-3.5 w-3.5" /> Smart (AI + Text Overlay)
                          </TabsTrigger>
                          <TabsTrigger value="ai" className="flex-1 gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> AI Background Only
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="smart" className="space-y-3 mt-3">
                          <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
                            <p className="text-xs text-primary font-medium flex items-center gap-1">
                              <Layers className="h-3 w-3" /> Zero spelling errors guaranteed
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              AI generates a clean background scene — text is added programmatically as a crisp overlay layer.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Background Scene Prompt</Label>
                            <Textarea
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              rows={2}
                              className="text-xs"
                              placeholder="e.g., Professional office workspace, dark moody atmosphere..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1"><Type className="h-3 w-3" /> Headline Text</Label>
                              <Input
                                value={overlayHeadline}
                                onChange={(e) => setOverlayHeadline(e.target.value)}
                                className="text-xs h-8"
                                placeholder="Auto-filled from post"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">CTA Text</Label>
                              <Input
                                value={overlayCta}
                                onChange={(e) => setOverlayCta(e.target.value)}
                                className="text-xs h-8"
                                placeholder="e.g., Call us today"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Hashtags (space-separated)</Label>
                            <Input
                              value={overlayHashtags}
                              onChange={(e) => setOverlayHashtags(e.target.value)}
                              className="text-xs h-8"
                              placeholder="#Hillsboro #WebDesign #GMK"
                            />
                          </div>
                          <Button
                            onClick={handleGenerateSmartImage}
                            disabled={!imagePrompt || generateSmartImage.isPending}
                            className="w-full gap-2"
                          >
                            {generateSmartImage.isPending ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Smart Image...</>
                            ) : (
                              <><Layers className="h-4 w-4" /> {smartImageUrl ? "Regenerate Smart Image" : "Generate Smart Image"}</>
                            )}
                          </Button>
                          {smartImageUrl && (
                            <div className="rounded-lg overflow-hidden border border-border">
                              <img src={smartImageUrl} alt="Smart Generated" className="w-full h-auto" />
                              <div className="p-2 bg-muted/30 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">AI background + programmatic text overlay</span>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setGeneratedImageUrl(smartImageUrl); toast.success("Set as post image"); }}>
                                  Use for Post
                                </Button>
                              </div>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="ai" className="space-y-3 mt-3">
                          <Textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            rows={3}
                            className="text-xs"
                            placeholder="Image prompt..."
                          />
                          <Button
                            onClick={handleGenerateImage}
                            disabled={!imagePrompt || generateImage.isPending}
                            variant="outline"
                            className="w-full gap-2"
                          >
                            {generateImage.isPending ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                            ) : (
                              <><ImageIcon className="h-4 w-4" /> {generatedImageUrl ? "Regenerate AI Image" : "Generate AI Image"}</>
                            )}
                          </Button>
                          {generatedImageUrl && (
                            <div className="rounded-lg overflow-hidden border border-border">
                              <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      {/* Also allow uploading to replace the AI image */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Upload className="h-3 w-3" /> Or upload your own
                        </Label>
                        <MediaUploadButton
                          compact
                          onUploadComplete={(url) => {
                            if (url) {
                              setGeneratedImageUrl(url);
                              setSmartImageUrl(url);
                            }
                          }}
                          currentUrl={smartImageUrl || generatedImageUrl || undefined}
                          allowVideo={true}
                        />
                      </div>
                    </>
                  )}
                </div>
                {/* Post Preview Panel — shown when content exists */}
                {generatedContent && (
                  <div className="border-t border-border pt-4 space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary" /> Post Preview
                    </Label>
                    <PostPreviewPanel
                      content={generatedContent}
                      imageUrl={smartImageUrl || generatedImageUrl || undefined}
                      brandName={brands?.find(b => b.id.toString() === selectedBrand)?.name}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Generated content will appear here</p>
                <p className="text-xs mt-1">Select a brand and format, then click Generate</p>
                {(hasShopify || hasServices) && (
                  <p className="text-xs mt-2 text-primary">
                    Content sources detected — product/service data will be mixed into rotation
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="case_study">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Input Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  Before &amp; After Case Study
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Brand *</Label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger>
                    <SelectContent>
                      {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={csServiceType} onValueChange={setCsServiceType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Custom Fabrication", "Plumbing", "HVAC", "Electrical", "Landscaping", "Painting", "Roofing", "Flooring", "General Contracting", "Cleaning Services", "Fencing", "Concrete & Masonry", "Other"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Drop Zones — each slot uses a stable useCallback handler (no curried inline fns) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Before */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Before Photo *</Label>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleCsBeforeDrop}
                      className="relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-colors border-border hover:border-primary/50 bg-secondary/20 hover:bg-secondary/40"
                      style={{ minHeight: 120 }}
                      onClick={() => document.getElementById("cs-before-input")?.click()}
                    >
                      {csBeforeFile ? (
                        <img src={csBeforeFile.url} alt="Before" className="w-full h-full object-cover" style={{ minHeight: 120, maxHeight: 160 }} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-6 gap-2 text-muted-foreground select-none">
                          <Upload className="h-6 w-6 opacity-40" />
                          <span className="text-xs text-center">Drop or click<br />to upload</span>
                        </div>
                      )}
                      <input id="cs-before-input" type="file" accept="image/*" className="hidden" onChange={handleCsBeforePick} />
                      {csBeforeFile && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">Before</div>
                      )}
                    </div>
                  </div>
                  {/* After */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">After Photo *</Label>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleCsAfterDrop}
                      className="relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-colors border-border hover:border-primary/50 bg-secondary/20 hover:bg-secondary/40"
                      style={{ minHeight: 120 }}
                      onClick={() => document.getElementById("cs-after-input")?.click()}
                    >
                      {csAfterFile ? (
                        <img src={csAfterFile.url} alt="After" className="w-full h-full object-cover" style={{ minHeight: 120, maxHeight: 160 }} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-6 gap-2 text-muted-foreground select-none">
                          <Upload className="h-6 w-6 opacity-40" />
                          <span className="text-xs text-center">Drop or click<br />to upload</span>
                        </div>
                      )}
                      <input id="cs-after-input" type="file" accept="image/*" className="hidden" onChange={handleCsAfterPick} />
                      {csAfterFile && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">After</div>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateCaseStudy}
                  disabled={!selectedBrand || !csBeforeFile || !csAfterFile || generateCaseStudy.isPending}
                  className="w-full gap-2"
                  size="lg"
                >
                  {generateCaseStudy.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing photos...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Case Study Caption</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Output Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generated Caption</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {csGenerated ? (
                  <>
                    <div className="relative">
                      <Textarea
                        value={csGenerated}
                        onChange={(e) => setCsGenerated(e.target.value)}
                        rows={10}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{csGenerated.length} characters — Edit as needed</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={handleCsCopy} className="gap-1.5" disabled={csCopied}>
                        {csCopied ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleGenerateCaseStudy} disabled={generateCaseStudy.isPending} className="gap-1.5">
                        {generateCaseStudy.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating...</> : <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>}
                      </Button>
                    </div>
                    <div className="border-t border-border pt-4 space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary" /> Post Preview
                      </Label>
                      <PostPreviewPanel
                        content={csGenerated}
                        imageUrl={csAfterFile?.url}
                        brandName={brands?.find(b => b.id.toString() === selectedBrand)?.name}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Camera className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Upload before &amp; after photos to generate</p>
                    <p className="text-xs mt-1">The AI will analyze the transformation and write an engaging caption</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
