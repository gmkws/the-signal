import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Radio, Zap, Calendar, BarChart3, Shield, Globe } from "lucide-react";

const GMK_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663051732739/d2LCzmfWzkc5vSTipW9iNY/gmk_logo_61e52eac.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={GMK_LOGO_URL} alt="GMK Web Solutions" className="h-8" />
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg tracking-tight">The Signal</span>
            </div>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 md:py-32">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-8">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">AI-Powered Social Media Automation</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            Your Social Media
            <span className="text-primary"> On Autopilot</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Generate AI-powered content in your brand's voice, schedule posts, and auto-publish to Facebook and Instagram. Built for agencies managing multiple client brands.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="px-8">
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Everything You Need to Manage Social at Scale
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Zap,
                title: "AI Content Engine",
                description: "Generate posts in your brand's voice using multiple content formats — from value-first tips to hook-and-solve carousels.",
              },
              {
                icon: Calendar,
                title: "Smart Scheduling",
                description: "Content calendar with automated posting to Facebook and Instagram. Set it and forget it, or review before publishing.",
              },
              {
                icon: BarChart3,
                title: "Analytics & Insights",
                description: "Track engagement, reach, and performance across all your brands and platforms in one unified dashboard.",
              },
              {
                icon: Shield,
                title: "Client Portal",
                description: "Two-tier access for clients: Managed (view-only) or Premium (full editing). Each client sees only their brand.",
              },
              {
                icon: Globe,
                title: "Meta API Integration",
                description: "Direct connection to Facebook Pages and Instagram Business accounts via Meta Graph API for seamless publishing.",
              },
              {
                icon: Radio,
                title: "Multi-Brand Management",
                description: "Manage up to 5 client brands with individual voice settings, social accounts, and content calendars.",
              },
            ].map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl border border-border bg-card">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={GMK_LOGO_URL} alt="GMK" className="h-6 opacity-60" />
            <span className="text-sm text-muted-foreground">GMK Web Solutions — Enterprise Web Architects</span>
          </div>
          <p className="text-sm text-muted-foreground">Hillsboro, Oregon</p>
        </div>
      </footer>
    </div>
  );
}
