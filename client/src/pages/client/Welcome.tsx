import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Facebook,
  Instagram,
  Wrench,
  CalendarDays,
  Zap,
  ArrowRight,
  Sparkles,
  Radio,
} from "lucide-react";
import { useLocation } from "wouter";

const GMK_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663051732739/d2LCzmfWzkc5vSTipW9iNY/gmk_logo_61e52eac.png";

interface ChecklistItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  path: string;
  priority: "required" | "recommended" | "optional";
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "facebook",
    icon: Facebook,
    title: "Connect Facebook Page",
    description: "Link your Facebook Business Page so The Signal can auto-post on your behalf.",
    action: "Connect Facebook",
    path: "/client/notifications",
    priority: "required",
  },
  {
    id: "instagram",
    icon: Instagram,
    title: "Connect Instagram Account",
    description: "Connect your Instagram Business account for visual content publishing.",
    action: "Connect Instagram",
    path: "/client/notifications",
    priority: "required",
  },
  {
    id: "services",
    icon: Wrench,
    title: "Fill out Service Spotlight",
    description: "Add your services, service areas, and CTAs so the AI can generate service-focused posts.",
    action: "Add Services",
    path: "/client/services",
    priority: "recommended",
  },
  {
    id: "events",
    icon: CalendarDays,
    title: "Add your first event",
    description: "Have a recurring show, class, or event? Add it and The Signal will auto-generate a promo sequence.",
    action: "Add Event",
    path: "/client/events",
    priority: "optional",
  },
  {
    id: "posts",
    icon: Zap,
    title: "Review your first AI posts",
    description: "The Signal has already started generating content in your brand's voice. Review and approve your first batch.",
    action: "View Posts",
    path: "/client/posts",
    priority: "recommended",
  },
];

export default function Welcome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: brands } = trpc.brand.list.useQuery();
  const brand = brands?.[0];

  const { data: socialAccounts } = trpc.social.listByBrand.useQuery(
    { brandId: brand?.id ?? 0 },
    { enabled: !!brand?.id }
  );

  const { data: services } = trpc.service.list.useQuery(
    { brandId: brand?.id ?? 0 },
    { enabled: !!brand?.id }
  );

  const { data: events } = trpc.event.upcoming.useQuery(
    { brandId: brand?.id },
    { enabled: !!brand?.id }
  );

  const { data: posts } = trpc.post.list.useQuery(
    { brandId: brand?.id },
    { enabled: !!brand?.id }
  );

  // Determine completion status for each checklist item
  const hasFacebook = socialAccounts?.some((a: { platform: string }) => a.platform === "facebook");
  const hasInstagram = socialAccounts?.some((a: { platform: string }) => a.platform === "instagram");
  const hasServices = (services?.length ?? 0) > 0;
  const hasEvents = (events?.length ?? 0) > 0;
  const hasPosts = (posts?.length ?? 0) > 0;

  const completionMap: Record<string, boolean> = {
    facebook: !!hasFacebook,
    instagram: !!hasInstagram,
    services: hasServices,
    events: hasEvents,
    posts: hasPosts,
  };

  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const allRequiredDone = completionMap.facebook && completionMap.instagram;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <img src={GMK_LOGO_URL} alt="GMK Web Solutions" className="h-10 mx-auto mb-6 opacity-80" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-4">
            <CheckCircle2 className="h-4 w-4" />
            Brand Approved
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Welcome to The Signal{brand?.name ? `, ${brand.name}` : ""}!
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Your brand is live. Complete the setup checklist below to get the most out of your automated content engine.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">{completedCount} of {totalCount} steps complete</span>
            <div className="w-48">
              <Progress value={progressPercent} className="h-2" />
            </div>
            <Badge
              variant="outline"
              className={progressPercent === 100 ? "border-green-500/30 text-green-400" : "border-cyan-500/30 text-cyan-400"}
            >
              {progressPercent}%
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {/* All done banner */}
        {progressPercent === 100 && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-6 pb-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">You're fully set up!</p>
                <p className="text-sm text-muted-foreground">The Signal is running. Content is being generated and scheduled automatically.</p>
              </div>
              <Button
                onClick={() => navigate("/client")}
                className="bg-green-500 hover:bg-green-600 text-white flex-shrink-0"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Required items first */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Required</p>
          {CHECKLIST_ITEMS.filter(i => i.priority === "required").map(item => (
            <ChecklistCard
              key={item.id}
              item={item}
              done={completionMap[item.id]}
              onAction={() => navigate(item.path)}
            />
          ))}
        </div>

        {/* Recommended items */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Recommended</p>
          {CHECKLIST_ITEMS.filter(i => i.priority === "recommended").map(item => (
            <ChecklistCard
              key={item.id}
              item={item}
              done={completionMap[item.id]}
              onAction={() => navigate(item.path)}
            />
          ))}
        </div>

        {/* Optional items */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Optional but powerful</p>
          {CHECKLIST_ITEMS.filter(i => i.priority === "optional").map(item => (
            <ChecklistCard
              key={item.id}
              item={item}
              done={completionMap[item.id]}
              onAction={() => navigate(item.path)}
            />
          ))}
        </div>

        {/* Skip to dashboard */}
        {!allRequiredDone && (
          <div className="pt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/client")}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now — go to dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {allRequiredDone && progressPercent < 100 && (
          <div className="pt-4 text-center">
            <Button
              onClick={() => navigate("/client")}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Radio className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-8 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Questions? Email{" "}
            <a href="mailto:gerrit@gmkwebsolutions.com" className="text-cyan-400 hover:underline">
              gerrit@gmkwebsolutions.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistCard({
  item,
  done,
  onAction,
}: {
  item: ChecklistItem;
  done: boolean;
  onAction: () => void;
}) {
  const Icon = item.icon;

  return (
    <Card className={`border transition-colors ${done ? "bg-card/50 border-green-500/20" : "bg-card border-border hover:border-cyan-500/30"}`}>
      <CardContent className="pt-5 pb-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          done ? "bg-green-500/20" : "bg-cyan-500/10"
        }`}>
          <Icon className={`h-5 w-5 ${done ? "text-green-400" : "text-cyan-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`font-medium text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {item.title}
            </p>
            {done && (
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
        </div>
        {!done && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            className="flex-shrink-0 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50"
          >
            {item.action}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {done && (
          <div className="flex-shrink-0">
            <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">Done</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
