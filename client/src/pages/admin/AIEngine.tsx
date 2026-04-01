import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Sparkles, Image as ImageIcon, Copy, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CONTENT_TYPE_LABELS } from "@shared/types";

export default function AdminAI() {
  const utils = trpc.useUtils();
  const { data: brands } = trpc.brand.list.useQuery();

  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [contentType, setContentType] = useState<string>("hey_tony");
  const [customTopic, setCustomTopic] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");

  const generatePost = trpc.ai.generatePost.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      setImagePrompt(data.suggestedImagePrompt);
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

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      toast.success("Post saved as draft!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleGenerate = () => {
    if (!selectedBrand) { toast.error("Select a brand first"); return; }
    generatePost.mutate({
      brandId: parseInt(selectedBrand),
      contentType: contentType as any,
      customTopic: customTopic || undefined,
    });
  };

  const handleGenerateImage = () => {
    if (!imagePrompt) { toast.error("No image prompt available"); return; }
    generateImage.mutate({ prompt: imagePrompt });
  };

  const handleSaveAsDraft = () => {
    if (!selectedBrand || !generatedContent) return;
    createPost.mutate({
      brandId: parseInt(selectedBrand),
      content: generatedContent,
      imageUrl: generatedImageUrl || undefined,
      contentType: contentType as any,
      status: "draft",
      aiGenerated: true,
      platforms: ["facebook", "instagram"],
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          AI Content Engine
        </h1>
        <p className="text-muted-foreground">Generate social media content in your brand's voice</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Settings</CardTitle>
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
              <Label>Content Format</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {contentType === "hey_tony" && "Value-first tips — SEO fixes, AI tips, website mistakes"}
                {contentType === "hook_solve" && "Problem → Solution format with visual hooks"}
                {contentType === "auditor_showcase" && "Before/after site audit showcases"}
                {contentType === "local_tips" && "Hillsboro/Washington County business tips"}
                {contentType === "machine_series" && "\"Your website is a machine\" educational series"}
                {contentType === "print_digital" && "Print + digital full-stack capability highlights"}
                {contentType === "custom" && "Custom post with your own topic"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Custom Topic (optional)</Label>
              <Input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g., Why local businesses need schema markup"
              />
            </div>

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
            <CardTitle className="text-base">Generated Content</CardTitle>
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

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1">
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSaveAsDraft} disabled={createPost.isPending} className="gap-1">
                    <Save className="h-3.5 w-3.5" /> Save as Draft
                  </Button>
                </div>

                {/* Image Generation */}
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Image Generation
                  </Label>
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
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating Image...</>
                    ) : (
                      <><ImageIcon className="h-4 w-4" /> Generate Image</>
                    )}
                  </Button>
                  {generatedImageUrl && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Generated content will appear here</p>
                <p className="text-xs mt-1">Select a brand and format, then click Generate</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
