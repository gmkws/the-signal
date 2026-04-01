import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, FileText, Calendar, Bell, TrendingUp, Zap, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { POST_STATUS_LABELS } from "@shared/types";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: brands, isLoading: brandsLoading } = trpc.brand.list.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.post.stats.useQuery({});
  const { data: unreadCount } = trpc.notification.unreadCount.useQuery({});
  const { data: recentPosts } = trpc.post.list.useQuery({ limit: 5 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Overview of all brands and content</p>
        </div>
        <Button onClick={() => setLocation("/admin/ai")} className="gap-2">
          <Zap className="h-4 w-4" />
          Generate Content
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{brandsLoading ? <Skeleton className="h-7 w-8" /> : brands?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Brands</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <FileText className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? <Skeleton className="h-7 w-8" /> : stats?.total ?? 0}</p>
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
                <p className="text-2xl font-bold">{statsLoading ? <Skeleton className="h-7 w-8" /> : stats?.scheduled ?? 0}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
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
                <p className="text-xs text-muted-foreground">Unread Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Brands Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Brands</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/brands")} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {brandsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : brands && brands.length > 0 ? (
              <div className="space-y-3">
                {brands.slice(0, 5).map((brand) => (
                  <div key={brand.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{brand.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{brand.clientTier} tier</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={brand.autoPostEnabled ? "default" : "secondary"} className="text-xs">
                        {brand.autoPostEnabled ? "Auto" : "Manual"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No brands yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setLocation("/admin/brands")}>
                  Add First Brand
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Posts</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/posts")} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentPosts && recentPosts.length > 0 ? (
              <div className="space-y-3">
                {recentPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{post.content.substring(0, 60)}...</p>
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
                <p className="text-sm">No posts yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setLocation("/admin/ai")}>
                  Generate First Post
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Post Stats Bar */}
      {stats && stats.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Post Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Draft", value: stats.draft, color: "text-muted-foreground" },
                { label: "Scheduled", value: stats.scheduled, color: "text-chart-1" },
                { label: "Published", value: stats.published, color: "text-chart-5" },
                { label: "Failed", value: stats.failed, color: "text-destructive" },
                { label: "Total", value: stats.total, color: "text-foreground" },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 rounded-lg bg-secondary/30">
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
