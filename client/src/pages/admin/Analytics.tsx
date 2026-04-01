import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Eye, Users, Heart, MessageCircle, Share2, MousePointer } from "lucide-react";
import { useState } from "react";

export default function AdminAnalytics() {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const { data: brands } = trpc.brand.list.useQuery();
  const { data: stats } = trpc.post.stats.useQuery({
    brandId: selectedBrand ? parseInt(selectedBrand) : undefined,
  });

  const brandId = selectedBrand ? parseInt(selectedBrand) : undefined;
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );

  const metrics = [
    { icon: Eye, label: "Impressions", value: summary?.impressions ?? 0, color: "text-blue-400" },
    { icon: Users, label: "Reach", value: summary?.reach ?? 0, color: "text-emerald-400" },
    { icon: Heart, label: "Likes", value: summary?.likes ?? 0, color: "text-pink-400" },
    { icon: MessageCircle, label: "Comments", value: summary?.comments ?? 0, color: "text-amber-400" },
    { icon: Share2, label: "Shares", value: summary?.shares ?? 0, color: "text-purple-400" },
    { icon: MousePointer, label: "Clicks", value: summary?.clicks ?? 0, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics
          </h1>
          <p className="text-muted-foreground">Track performance across brands and platforms</p>
        </div>
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a brand" /></SelectTrigger>
          <SelectContent>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Post Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total", value: stats?.total ?? 0 },
              { label: "Published", value: stats?.published ?? 0 },
              { label: "Scheduled", value: stats?.scheduled ?? 0 },
              { label: "Drafts", value: stats?.draft ?? 0 },
              { label: "Failed", value: stats?.failed ?? 0 },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-lg bg-secondary/30">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Metrics */}
      {selectedBrand ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <metric.icon className={`h-5 w-5 ${metric.color}`} />
                  </div>
                  <div>
                    {summaryLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{metric.value.toLocaleString()}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Select a brand</h3>
            <p className="text-sm text-muted-foreground">Choose a brand above to view detailed analytics</p>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Analytics data is populated from Meta Graph API insights when social accounts are connected and posts are published. Connect your Facebook and Instagram accounts in the Social Accounts section to start tracking real engagement data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
