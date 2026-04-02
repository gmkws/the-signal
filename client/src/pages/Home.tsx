import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Zap, BarChart3, Calendar, Bot, Share2, ShoppingBag,
  ArrowRight, CheckCircle2, Sparkles, Building2, Star
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AI Content Engine",
    description: "Generates posts in your brand's exact voice — educational tips, product spotlights, service highlights, and local content.",
  },
  {
    icon: Calendar,
    title: "Event Promotion Engine",
    description: "Add an event once. The Signal automatically creates a promo sequence — teaser, reminder, day-of push, and recap.",
  },
  {
    icon: Share2,
    title: "Auto-Post to Facebook & Instagram",
    description: "Connects directly to Meta's Graph API. Posts go out automatically at optimal times, or queue for your approval.",
  },
  {
    icon: ShoppingBag,
    title: "Shopify & Service Spotlight",
    description: "Pull from your product catalog or service list. The AI mixes product posts, service highlights, and brand content in rotation.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Track post performance, engagement trends, and content health across all your connected platforms.",
  },
  {
    icon: Zap,
    title: "Smart Image Generation",
    description: "AI generates background visuals. Text, CTAs, and brand names are added programmatically — zero spelling errors.",
  },
];

const TIERS = [
  {
    name: "Managed",
    description: "We handle everything. You review and approve.",
    features: [
      "AI content generated for you",
      "Content calendar view",
      "Pause or request edits",
      "Admin manages your brand",
    ],
    highlight: false,
  },
  {
    name: "Premium",
    description: "Full control. Create, edit, and approve your own content.",
    features: [
      "Everything in Managed",
      "Create and edit your own posts",
      "Approve or reject AI content",
      "Add events and manage promotions",
      "Service Spotlight management",
    ],
    highlight: true,
  },
];

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/client");
      }
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Zap className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground tracking-tight">The Signal</span>
              <span className="text-muted-foreground text-xs ml-2 hidden sm:inline">by GMK Web Solutions</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                onClick={() => navigate(user?.role === "admin" ? "/admin" : "/client")}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => window.location.href = getLoginUrl()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Button>
                <Button
                  onClick={handleGetStarted}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-24 text-center relative">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 mb-6 inline-flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            By GMK Web Solutions — Enterprise Web Architects
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 leading-tight">
            Social media that{" "}
            <span className="text-cyan-400">runs itself.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            The Signal generates AI-powered content in your brand's voice and auto-posts to Facebook and Instagram — so you can focus on running your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-base px-8 gap-2"
            >
              <Sparkles className="h-5 w-5" />
              Start Your Brand Setup
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open("https://gmkwebsolutions.com", "_blank")}
              className="text-base px-8 border-border"
            >
              Learn About GMK
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Serving local businesses in Hillsboro &amp; Washington County, Oregon
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">Everything your social media needs</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From content generation to auto-posting — The Signal handles the full workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="bg-card border-border hover:border-cyan-500/30 transition-colors">
                  <CardContent className="pt-6 pb-6">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-20 border-t border-border bg-card/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">Two ways to use The Signal</h2>
            <p className="text-muted-foreground text-lg">
              Whether you want us to handle everything or stay in full control — we have a plan for you.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={`border ${tier.highlight ? "border-cyan-500 bg-cyan-500/5" : "border-border bg-card"}`}
              >
                <CardContent className="pt-6 pb-6">
                  {tier.highlight && (
                    <Badge className="bg-cyan-500 text-white mb-3 gap-1">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  )}
                  <h3 className="text-xl font-bold text-foreground mb-1">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm mb-5">{tier.description}</p>
                  <ul className="space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm">
              Tier is set by GMK Web Solutions based on your plan. <a href="https://gmkwebsolutions.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Contact us</a> to discuss options.
            </p>
          </div>
        </div>
      </section>

      {/* GMK Product Suite */}
      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Part of the GMK product suite</h2>
            <p className="text-muted-foreground">
              The Signal is one of three AI-powered tools built by GMK Web Solutions for local businesses.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "The Architect",
                description: "AI chatbot trained on your business. Answers customer questions 24/7 on your website.",
                tag: "AI Chatbot",
                active: false,
              },
              {
                name: "The Auditor",
                description: "Full SEO audit of your website. Identifies issues, scores your pages, and shows before/after improvements.",
                tag: "SEO Tool",
                active: false,
              },
              {
                name: "The Signal",
                description: "AI-powered social media automation. Generates content and posts to Facebook and Instagram automatically.",
                tag: "Social Media",
                active: true,
              },
            ].map((product) => (
              <Card
                key={product.name}
                className={`border ${product.active ? "border-cyan-500/50 bg-cyan-500/5" : "border-border bg-card"}`}
              >
                <CardContent className="pt-6 pb-6">
                  <Badge
                    variant="outline"
                    className={`mb-3 text-xs ${product.active ? "border-cyan-500/30 text-cyan-400" : "border-border text-muted-foreground"}`}
                  >
                    {product.tag}
                  </Badge>
                  <h3 className={`font-bold text-lg mb-2 ${product.active ? "text-cyan-400" : "text-foreground"}`}>
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                  {product.active && (
                    <Badge className="mt-3 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                      You are here
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border bg-card/30">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to put your social media on autopilot?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Set up your brand in under 5 minutes. The Signal handles the rest.
          </p>
          <Button
            size="lg"
            onClick={handleGetStarted}
            className="bg-cyan-500 hover:bg-cyan-600 text-white text-base px-10 gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Get Started Free
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            A GMK Web Solutions product · Hillsboro, Oregon
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-muted-foreground">
              The Signal by <a href="https://gmkwebsolutions.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">GMK Web Solutions</a>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="https://gmkwebsolutions.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GMK Web Solutions</a>
            <a href="mailto:gerrit@gmkwebsolutions.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
