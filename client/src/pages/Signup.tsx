import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Radio, Eye, EyeOff, Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Signup() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"managed" | "premium">("managed");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    window.location.href = user.role === "admin" ? "/admin" : "/client";
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // After registration, try to start Stripe checkout if configured
      try {
        const stripeStatus = await fetch("/api/stripe/status").then(r => r.json());
        if (stripeStatus.configured) {
          const checkoutRes = await fetch("/api/stripe/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tier: selectedTier }),
          });
          const checkoutData = await checkoutRes.json();
          if (checkoutData.url) {
            window.location.href = checkoutData.url;
            return;
          }
        }
      } catch {
        // Stripe not configured — just redirect to dashboard
      }

      // Redirect to onboarding or dashboard
      window.location.href = "/onboarding";
    } catch (err: any) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const tiers = [
    {
      id: "managed" as const,
      name: "Managed",
      description: "We handle everything for you",
      features: [
        "AI-generated content",
        "Auto-posting to social media",
        "Content calendar management",
        "Monthly analytics reports",
        "Request edits & pauses",
      ],
    },
    {
      id: "premium" as const,
      name: "Premium",
      description: "Full control with AI assistance",
      features: [
        "Everything in Managed",
        "Edit & approve posts directly",
        "Upload custom media",
        "Real-time analytics dashboard",
        "Priority support",
      ],
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-8 w-8 text-cyan-400" />
            <span className="text-2xl font-bold text-foreground">The Signal</span>
          </div>
          <p className="text-sm text-muted-foreground">by GMK Web Solutions</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>Choose a plan and get started with AI-powered social media</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Tier Selection */}
              <div className="space-y-3">
                <Label>Select your plan</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedTier === tier.id
                          ? "border-cyan-400 bg-cyan-400/10 ring-1 ring-cyan-400/50"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">{tier.name}</span>
                        {selectedTier === tier.id && (
                          <div className="h-5 w-5 rounded-full bg-cyan-400 flex items-center justify-center">
                            <Check className="h-3 w-3 text-background" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{tier.description}</p>
                      <ul className="space-y-1">
                        {tier.features.map((f) => (
                          <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => navigate("/login")}
              >
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by GMK Web Solutions
        </p>
      </div>
    </div>
  );
}
