import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, FileText, Calendar, Bell, ArrowRight, Radio } from "lucide-react";
import { useLocation } from "wouter";
import { POST_STATUS_LABELS } from "@shared/types";

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { data: brands, isLoading: brandsLoading } = trpc.brand.list.useQuery();
  const brand = brands?.[0]; // Client's primary brand
  const { data: stats } = trpc.post.stats.useQuery(
    { brandId: brand?.id },
    { enabled: !!brand }
  );
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(
    { brandId: brand?.id },
    { enabled: !!brand }
  );
  const { data: recentPosts } = trpc.post.list.useQuery(
    { brandId: brand?.id, limit: 5 },
    { enabled: !!brand }
  );

  if (brandsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Radio className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Welcome to The Signal</h2>
            <p className="text-sm text-muted-foreground">
              Your brand hasn't been set up yet. Please contact your account manager at GMK Web Solutions to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPremium = brand.clientTier === "premium";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
          <Badge variant="outline" className="capitalize">{brand.clientTier}</Badge>
        </div>
        <p className="text-muted-foreground">
          {isPremium ? "Premium access — full editing and approval capabilities" : "Managed access — view content and request changes"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-5/10">
                <Calendar className="h-5 w-5 text-chart-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.scheduled ?? 0}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Building2 className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.published ?? 0}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Bell className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Posts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Recent Posts</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/client/posts")} className="gap-1 text-xs">
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentPosts && recentPosts.length > 0 ? (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{post.content.substring(0, 80)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString() : "No date"}
                    </p>
                  </div>
                  <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs ml-2 shrink-0">
                    {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS] || post.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No posts yet. Your content team is working on it!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Post Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Post Status</p>
              <p className="text-xs text-muted-foreground">
                {brand.autoPostEnabled
                  ? "Posts are automatically published on schedule"
                  : "Posts are queued for review before publishing"}
              </p>
            </div>
            <Badge variant={brand.autoPostEnabled ? "default" : "secondary"}>
              {brand.autoPostEnabled ? "Active" : "Manual"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
