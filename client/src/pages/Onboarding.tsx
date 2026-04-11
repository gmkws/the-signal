import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Building2, Mic2, ShoppingBag, Share2, Calendar, CheckCircle2,
  ChevronRight, ChevronLeft, Bot, Send, Loader2, Sparkles, X, Plus, MapPin
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Brand Basics", description: "Tell us about your business", icon: Building2 },
  { id: 2, title: "Brand Voice", description: "How do you want to sound?", icon: Mic2 },
  { id: 3, title: "Content Sources", description: "What do you want to post about?", icon: ShoppingBag },
  { id: 4, title: "Social Accounts", description: "Connect your platforms", icon: Share2 },
  { id: 5, title: "Schedule", description: "When should we post?", icon: Calendar },
  { id: 6, title: "Review & Launch", description: "Confirm and go live", icon: CheckCircle2 },
];

const TONE_OPTIONS = ["Professional", "Friendly", "Bold", "Educational", "Conversational", "Authoritative"];
const STYLE_OPTIONS = ["Direct", "Story-driven", "Value-first", "Humorous", "Inspirational", "Data-driven"];
const INDUSTRY_OPTIONS = [
  "Roofing", "Cleaning Services", "Electrical", "Plumbing", "HVAC", "Landscaping",
  "Junk Removal", "Painting", "Flooring", "Remodeling", "Auto Repair", "Retail",
  "Restaurant / Food", "Health & Wellness", "Real Estate", "Legal Services",
  "Marketing / Agency", "Technology", "E-commerce", "Other"
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function extractContent(content: string | any[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((c: any) => c.type === "text");
    return textPart?.text || "";
  }
  return "";
}

export default function Onboarding() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Form state
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [tone, setTone] = useState("Professional");
  const [style, setStyle] = useState("Direct");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [avoidWords, setAvoidWords] = useState<string[]>([]);
  const [avoidInput, setAvoidInput] = useState("");
  const [samplePost, setSamplePost] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [contentSource, setContentSource] = useState<"shopify" | "services" | "both" | "general">("general");
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [autoPost, setAutoPost] = useState(false);

  // GBP state (tokens + location collected during step 4, saved after brand creation)
  const [gbpLocationOpen, setGbpLocationOpen] = useState(false);
  const [gbpLocations, setGbpLocations] = useState<Array<{ name: string; title: string; accountName: string }>>([]);
  const [gbpPendingTokens, setGbpPendingTokens] = useState<{ accessToken: string; refreshToken: string | null; expiresAt: string } | null>(null);
  const [gbpPendingLocation, setGbpPendingLocation] = useState<{ name: string; title: string } | null>(null);
  const [gbpConnecting, setGbpConnecting] = useState(false);

  // AI assistant state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your setup assistant. Ask me anything about setting up your brand on The Signal — I'm here to help!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const saveStep = trpc.onboarding.saveStep.useMutation();
  const complete = trpc.onboarding.complete.useMutation();
  const askAssistant = trpc.onboarding.askAssistant.useMutation();

  // GBP OAuth — no brandId needed yet; brand is created at the end of onboarding
  const getGbpOAuthUrl = trpc.gbp.getOAuthUrl.useQuery(
    { redirectUri: window.location.origin + "/api/google/callback" },
    { enabled: false }
  );

  const handleGbpCallback = trpc.gbp.handleCallback.useMutation({
    onSuccess: (data) => {
      setGbpPendingTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt });
      setGbpLocations(data.locations);
      setGbpConnecting(false);
      if (data.locations.length === 0) {
        toast.error("No Google Business locations found on this account");
      } else if (data.locations.length === 1) {
        setGbpPendingLocation(data.locations[0]);
        toast.success(`Google Business connected: ${data.locations[0].title}`);
      } else {
        setGbpLocationOpen(true);
      }
    },
    onError: (e) => {
      setGbpConnecting(false);
      toast.error(`GBP connect failed: ${e.message}`);
    },
  });

  const gbpConnect = trpc.gbp.connect.useMutation();
  const { data: onboardingState } = trpc.onboarding.getState.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (onboardingState?.currentStep) {
      setCurrentStep(onboardingState.currentStep);
    }
    if (onboardingState?.completed && onboardingState.approvalStatus === "approved") {
      navigate("/client");
    }
  }, [onboardingState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const handleNext = async () => {
    // Save current step data
    const stepData = getStepData(currentStep);
    await saveStep.mutateAsync({ step: currentStep, data: stepData });
    if (currentStep < STEPS.length) {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const getStepData = (step: number): Record<string, any> => {
    switch (step) {
      case 1: return { brandName, industry, website, location };
      case 2: return { tone, style, keywords, avoidWords, samplePost, customInstructions };
      case 3: return { contentSource };
      case 4: return { facebookConnected: false, instagramConnected: false };
      case 5: return { postsPerDay, autoPost };
      default: return {};
    }
  };

  // Listen for the GBP OAuth popup result
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "GBP_OAUTH_CODE" && data.code) {
        handleGbpCallback.mutate({
          code: data.code,
          redirectUri: data.redirectUri || (window.location.origin + "/api/google/callback"),
        });
      } else if (data.type === "GBP_OAUTH_ERROR") {
        setGbpConnecting(false);
        toast.error(`Google OAuth error: ${data.error}`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleGbpCallback]);

  const handleGbpOAuthClick = async () => {
    setGbpConnecting(true);
    try {
      const result = await getGbpOAuthUrl.refetch();
      const url = result.data?.url;
      if (!url) throw new Error("Could not get OAuth URL");
      window.open(url, "gbp_oauth", "width=600,height=700,noopener");
    } catch (e: any) {
      setGbpConnecting(false);
      toast.error(`Failed to start Google OAuth: ${e.message}`);
    }
  };

  const handleGbpSelectLocation = useCallback((loc: { name: string; title: string }, tokens: { accessToken: string; refreshToken: string | null; expiresAt: string }) => {
    setGbpPendingLocation(loc);
    setGbpLocationOpen(false);
    toast.success(`Google Business connected: ${loc.title}`);
  }, []);

  const handleComplete = async () => {
    if (!brandName.trim()) {
      toast.error("Brand name is required");
      setCurrentStep(1);
      return;
    }
    setIsCompleting(true);
    try {
      const result = await complete.mutateAsync({
        brandName,
        industry: industry || undefined,
        website: website || undefined,
        location: location || undefined,
        tone,
        style,
        keywords,
        avoidWords,
        samplePosts: samplePost ? [samplePost] : [],
        customInstructions,
        postsPerDay,
        autoPost,
      });
      // If the user connected GBP during step 4, save it now that we have a brandId
      if (gbpPendingLocation && gbpPendingTokens && result.brandId) {
        try {
          await gbpConnect.mutateAsync({
            brandId: result.brandId,
            locationName: gbpPendingLocation.name,
            locationTitle: gbpPendingLocation.title,
            accessToken: gbpPendingTokens.accessToken,
            refreshToken: gbpPendingTokens.refreshToken,
            expiresAt: gbpPendingTokens.expiresAt,
          });
        } catch (e: any) {
          console.warn("[Onboarding] GBP connect failed after brand creation:", e.message);
          // Don't block completion — they can connect from the dashboard later
        }
      }
      setIsDone(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete setup");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAskAssistant = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: question }]);
    try {
      const result = await askAssistant.mutateAsync({ question, currentStep, brandName: brandName || undefined });
      setChatMessages(prev => [...prev, { role: "assistant", content: extractContent(result.answer as any) || "I'm not sure — please contact GMK Web Solutions for help." }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords(prev => [...prev, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const addAvoidWord = () => {
    if (avoidInput.trim() && !avoidWords.includes(avoidInput.trim())) {
      setAvoidWords(prev => [...prev, avoidInput.trim()]);
      setAvoidInput("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">You're all set!</h1>
            <p className="text-muted-foreground text-lg">
              Your brand <strong className="text-foreground">{brandName}</strong> has been submitted for review.
            </p>
          </div>
          <Card className="bg-card border-border text-left">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-cyan-400 text-xs font-bold">1</span>
                </div>
                <p className="text-sm text-muted-foreground">Gerrit at GMK Web Solutions will review your brand setup — usually within 1 business day.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-cyan-400 text-xs font-bold">2</span>
                </div>
                <p className="text-sm text-muted-foreground">Once approved, you'll get access to your full dashboard to review and manage your content.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-cyan-400 text-xs font-bold">3</span>
                </div>
                <p className="text-sm text-muted-foreground">The Signal will start generating content in your brand's voice right away.</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            Questions? Email <a href="mailto:gerrit@gmkwebsolutions.com" className="text-cyan-400 hover:underline">gerrit@gmkwebsolutions.com</a>
          </p>
        </div>
      </div>
    );
  }

  const currentStepInfo = STEPS[currentStep - 1];
  const StepIcon = currentStepInfo.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <span className="text-cyan-400 font-bold text-sm">S</span>
            </div>
            <div>
              <span className="font-bold text-foreground">The Signal</span>
              <span className="text-muted-foreground text-sm ml-2">by GMK Web Solutions</span>
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
            Step {currentStep} of {STEPS.length}
          </Badge>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = step.id < currentStep;
              return (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isComplete ? "bg-cyan-500 text-white" :
                    isActive ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? "text-cyan-400 font-medium" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-xl">{currentStepInfo.title}</CardTitle>
                <CardDescription>{currentStepInfo.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Step 1: Brand Basics */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandName">Business Name <span className="text-red-400">*</span></Label>
                  <Input
                    id="brandName"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    placeholder="e.g., Smith's Roofing & Repair"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="https://yoursite.com"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">City / Service Area</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g., Hillsboro, OR"
                      className="bg-background border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Brand Voice */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How your brand sounds emotionally</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Style</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How your content is structured</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Keywords to use often</Label>
                  <div className="flex gap-2">
                    <Input
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addKeyword()}
                      placeholder="e.g., local, trusted, certified"
                      className="bg-background border-border"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {keywords.map(kw => (
                        <Badge key={kw} variant="secondary" className="gap-1">
                          {kw}
                          <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Words to avoid</Label>
                  <div className="flex gap-2">
                    <Input
                      value={avoidInput}
                      onChange={e => setAvoidInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addAvoidWord()}
                      placeholder="e.g., cheap, discount, free"
                      className="bg-background border-border"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addAvoidWord}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {avoidWords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {avoidWords.map(w => (
                        <Badge key={w} variant="destructive" className="gap-1 bg-red-500/20 text-red-400 border-red-500/30">
                          {w}
                          <button onClick={() => setAvoidWords(prev => prev.filter(a => a !== w))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="samplePost">Sample post (optional)</Label>
                  <Textarea
                    id="samplePost"
                    value={samplePost}
                    onChange={e => setSamplePost(e.target.value)}
                    placeholder="Paste an example of how you'd write a social post. The AI will match this style."
                    className="bg-background border-border min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customInstructions">Any other instructions?</Label>
                  <Textarea
                    id="customInstructions"
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g., Always mention we're family-owned. Never use exclamation marks. Focus on Washington County."
                    className="bg-background border-border min-h-[80px]"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Content Sources */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The Signal generates a mix of content types. Tell us what sources to pull from — the AI always adds general brand voice content regardless.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { value: "general", label: "General brand content only", description: "Tips, educational posts, local content, and brand voice posts. Great for any business." },
                    { value: "services", label: "Service Spotlight", description: "I'll add my services, service areas, and specials. The AI will generate service highlight posts, seasonal reminders, and booking CTAs." },
                    { value: "shopify", label: "Shopify store", description: "I have an online store. Connect it to pull products and generate product spotlight posts mixed into the rotation." },
                    { value: "both", label: "Both services and Shopify", description: "I have both a service business and an online store. Use both as content sources." },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setContentSource(opt.value as any)}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        contentSource === opt.value
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-border bg-background hover:border-cyan-500/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                          contentSource === opt.value ? "border-cyan-500 bg-cyan-500" : "border-muted-foreground"
                        }`} />
                        <div>
                          <p className="font-medium text-foreground text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {(contentSource === "shopify" || contentSource === "both") && (
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm text-amber-400">
                        <strong>Shopify connection:</strong> You'll be able to connect your Shopify store from the Integrations page after your brand is approved.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 4: Social Accounts */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your social accounts so The Signal can post automatically. Facebook and Instagram can be connected from your dashboard after approval — but you can connect Google Business Profile right now.
                </p>
                <div className="space-y-3">
                  <Card className="bg-background border-border">
                    <CardContent className="pt-4 pb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <span className="text-blue-400 font-bold text-sm">f</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">Facebook Page</p>
                          <p className="text-xs text-muted-foreground">Required for Facebook posting</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-muted text-muted-foreground">Connect later</Badge>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-4 pb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                          <span className="text-pink-400 font-bold text-sm">ig</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">Instagram Business</p>
                          <p className="text-xs text-muted-foreground">Requires a Facebook Page connection first</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-muted text-muted-foreground">Connect later</Badge>
                    </CardContent>
                  </Card>
                  <Card className={`bg-background border-border ${gbpPendingLocation ? "border-green-500/30" : ""}`}>
                    <CardContent className="pt-4 pb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${gbpPendingLocation ? "bg-green-500/20" : "bg-green-500/10"}`}>
                          <MapPin className={`h-5 w-5 ${gbpPendingLocation ? "text-green-400" : "text-green-600/60"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">Google Business Profile</p>
                          <p className="text-xs text-muted-foreground">
                            {gbpPendingLocation ? gbpPendingLocation.title : "Show up in Google Search & Maps"}
                          </p>
                        </div>
                      </div>
                      {gbpPendingLocation ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Connected</Badge>
                      ) : (
                        <Button
                          variant="outline" size="sm"
                          className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={handleGbpOAuthClick}
                          disabled={gbpConnecting || handleGbpCallback.isPending}
                        >
                          {(gbpConnecting || handleGbpCallback.isPending) ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...</>
                          ) : (
                            <><MapPin className="h-3.5 w-3.5" /> Connect</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-cyan-500/10 border-cyan-500/30">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-cyan-400">
                      Facebook and Instagram can be connected from your Integrations page after your brand is approved. Your content will be generated and queued in the meantime.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 5: Schedule */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label>Posts per day</Label>
                  <div className="flex gap-3">
                    {[1, 2].map(n => (
                      <button
                        key={n}
                        onClick={() => setPostsPerDay(n)}
                        className={`flex-1 py-3 rounded-lg border font-medium text-sm transition-colors ${
                          postsPerDay === n
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                            : "border-border bg-background text-foreground hover:border-cyan-500/50"
                        }`}
                      >
                        {n} post{n > 1 ? "s" : ""} / day
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We recommend starting with 1 post per day. You can always increase this later.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-posting</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Posts go live automatically without your approval
                      </p>
                    </div>
                    <Switch
                      checked={autoPost}
                      onCheckedChange={setAutoPost}
                    />
                  </div>
                  {!autoPost && (
                    <Card className="bg-amber-500/10 border-amber-500/30">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-amber-400">
                          <strong>Review mode:</strong> Posts will be queued for your approval before going live. You'll get notified when posts are ready to review.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  {autoPost && (
                    <Card className="bg-green-500/10 border-green-500/30">
                      <CardContent className="pt-3 pb-3">
                        <p className="text-xs text-green-400">
                          <strong>Auto-post mode:</strong> The Signal will post automatically at optimal times. You can pause anytime from your dashboard.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Brand</p>
                    <p className="font-medium text-foreground">{brandName || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Industry</p>
                    <p className="font-medium text-foreground">{industry || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Location</p>
                    <p className="font-medium text-foreground">{location || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Website</p>
                    <p className="font-medium text-foreground text-sm truncate">{website || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Voice</p>
                    <p className="font-medium text-foreground">{tone} · {style}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Content Sources</p>
                    <p className="font-medium text-foreground capitalize">{contentSource.replace("_", " ")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Posting</p>
                    <p className="font-medium text-foreground">{postsPerDay}/day · {autoPost ? "Auto" : "Review mode"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Google Business</p>
                    <p className="font-medium text-foreground">
                      {gbpPendingLocation ? gbpPendingLocation.title : <span className="text-muted-foreground">Not connected</span>}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    After submitting, Gerrit at GMK Web Solutions will review your brand setup and activate your account — typically within 1 business day.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              {currentStep < STEPS.length ? (
                <Button
                  onClick={handleNext}
                  disabled={currentStep === 1 && !brandName.trim()}
                  className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={isCompleting || !brandName.trim()}
                  className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isCompleting ? "Submitting..." : "Submit & Launch"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GBP Location Selector Dialog */}
      <Dialog open={gbpLocationOpen} onOpenChange={setGbpLocationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              Select a Google Business Location
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Choose which location to connect. Posts will be published to this listing.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {gbpLocations.map((loc) => (
              <button
                key={loc.name}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors"
                onClick={() => gbpPendingTokens && handleGbpSelectLocation(loc, gbpPendingTokens)}
              >
                <p className="text-sm font-medium">{loc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.name}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Chat */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <Card className="w-80 bg-card border-border shadow-2xl">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-cyan-400" />
                  </div>
                  <span className="font-medium text-sm text-foreground">Setup Assistant</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="h-48 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-cyan-500 text-white"
                        : "bg-muted text-foreground"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {askAssistant.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAskAssistant()}
                  placeholder="Ask anything..."
                  className="bg-background border-border text-xs h-8"
                />
                <Button
                  size="icon"
                  className="h-8 w-8 bg-cyan-500 hover:bg-cyan-600 flex-shrink-0"
                  onClick={handleAskAssistant}
                  disabled={askAssistant.isPending}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-600 flex items-center justify-center shadow-lg transition-colors"
          >
            <Bot className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
