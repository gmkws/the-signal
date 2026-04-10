import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Sparkles, Image as ImageIcon, Copy, Check, Save, Loader2, ShoppingBag, Wrench, Info, Layers, Type, RefreshCw, Lightbulb, CalendarDays, LayoutGrid } from "lucide-react";
import { useState, useCallback } from "react";
import FillScheduleModal from "@/components/FillScheduleModal";
import { PostPreviewPanel } from "@/components/PostPreviewPanel";
import CarouselBuilder from "@/components/CarouselBuilder";
import { MediaUploadButton } from "@/components/MediaUploadButton";
import { toast } from "sonner";
import { CONTENT_TYPE_LABELS } from "@shared/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  // Copy-to-clipboard feedback state
  const [copied, setCopied] = useState(false);
  // Fill Schedule modal
  const [fillScheduleOpen, setFillScheduleOpen] = useState(false);

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
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      setImagePrompt(data.suggestedImagePrompt);
      setGeneratedContentType(data.contentType);
      // Auto-fill the overlay headline from the LLM's short headline
      if (data.overlayHeadline) {
        setOverlayHeadline(data.overlayHeadline);
      }
      toast.success("Content generated!");
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

  const contentTypeDescription = (ct: string) => {
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

            <Button
              onClick={handleGenerate}
              disabled={!selectedBrand || generatePost.isPending}
              className="w-full gap-2"
              size="lg"
            >
              {generatePost.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
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

                {/* Image Generation */}
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Image Generation
                  </Label>
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
                          <><Layers className="h-4 w-4" /> Generate Smart Image</>
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
                          <><ImageIcon className="h-4 w-4" /> Generate AI Image</>
                        )}
                      </Button>
                      {generatedImageUrl && (
                        <div className="rounded-lg overflow-hidden border border-border">
                          <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                {/* Upload Your Own Media */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" /> Upload Your Own Media
                  </Label>
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
      </Tabs>
    </div>
  );
}
