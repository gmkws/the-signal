import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, Pencil, Trash2, Eye, Image as ImageIcon, ImageOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { POST_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@shared/types";
import { PostPreviewPanel } from "@/components/PostPreviewPanel";

export default function AdminPosts() {
  const utils = trpc.useUtils();
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [needsImageOnly, setNeedsImageOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const [viewPost, setViewPost] = useState<any>(null);
  const [form, setForm] = useState({
    brandId: "", content: "", imageUrl: "", contentType: "custom",
    scheduledAt: "", status: "draft", platforms: ["facebook"] as string[],
  });

  const { data: brands } = trpc.brand.list.useQuery();
  const { data: posts, isLoading } = trpc.post.list.useQuery({
    brandId: selectedBrand !== "all" ? parseInt(selectedBrand) : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    limit: 100,
  });

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post created"); setCreateOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updatePost = trpc.post.update.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => setForm({
    brandId: brands?.[0]?.id?.toString() || "", content: "", imageUrl: "",
    contentType: "custom", scheduledAt: "", status: "draft", platforms: ["facebook"],
  });

  const handleCreate = () => {
    if (!form.brandId || !form.content) return;
    createPost.mutate({
      brandId: parseInt(form.brandId),
      content: form.content,
      imageUrl: form.imageUrl || undefined,
      contentType: form.contentType as any,
      scheduledAt: form.scheduledAt || undefined,
      status: form.status as any,
      platforms: form.platforms,
    });
  };

  const openEdit = (post: any) => {
    setViewPost(post);
    setForm({
      brandId: post.brandId.toString(),
      content: post.content,
      imageUrl: post.imageUrl || "",
      contentType: post.contentType,
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "",
      status: post.status,
      platforms: post.platforms || ["facebook"],
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!viewPost) return;
    updatePost.mutate({
      id: viewPost.id,
      content: form.content,
      imageUrl: form.imageUrl || undefined,
      contentType: form.contentType as any,
      scheduledAt: form.scheduledAt || undefined,
      status: form.status as any,
      platforms: form.platforms,
    });
  };

  const getBrandName = (brandId: number) => brands?.find((b) => b.id === brandId)?.name || `Brand #${brandId}`;

  const statusVariant = (status: string) => {
    switch (status) {
      case "published": return "default" as const;
      case "scheduled": return "secondary" as const;
      case "failed": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  const togglePlatform = (platform: string) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  // Derived filtered list
  const filteredPosts = (posts ?? []).filter(p => !needsImageOnly || !p.imageUrl);
  const needsImageCount = (posts ?? []).filter(p => !p.imageUrl).length;

  const PostForm = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label>Brand *</Label>
        <Select value={form.brandId} onValueChange={(v) => setForm({ ...form, brandId: v })}>
          <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
          <SelectContent>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Content *</Label>
        <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} placeholder="Write your post content..." />
        <p className="text-xs text-muted-foreground">{form.content.length}/2000 characters</p>
      </div>
      <div className="space-y-2">
        <Label>Image URL</Label>
        <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Content Type</Label>
          <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Schedule Date & Time</Label>
        <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.platforms.includes("facebook")} onCheckedChange={() => togglePlatform("facebook")} />
            <span className="text-sm">Facebook</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.platforms.includes("instagram")} onCheckedChange={() => togglePlatform("instagram")} />
            <span className="text-sm">Instagram</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Create, edit, and manage social media posts</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(POST_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Needs Image quick filter */}
        <Button
          variant={needsImageOnly ? "default" : "outline"}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setNeedsImageOnly(v => !v)}
        >
          <ImageOff className="h-4 w-4" />
          Needs Image
          {needsImageCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${needsImageOnly ? "bg-background/20" : "bg-muted"}`}>
              {needsImageCount}
            </span>
          )}
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create New Post</DialogTitle></DialogHeader>
          <PostForm />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreate} disabled={!form.brandId || !form.content || createPost.isPending}>
              {createPost.isPending ? "Creating..." : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Post</DialogTitle></DialogHeader>
          <PostForm />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdate} disabled={updatePost.isPending}>
              {updatePost.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Preview Dialog */}
      <Dialog open={!!previewPost} onOpenChange={(open) => { if (!open) setPreviewPost(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Post Preview
              {previewPost && (
                <Badge variant="outline" className="text-xs ml-2">
                  {getBrandName(previewPost.brandId)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewPost && (
            <PostPreviewPanel
              content={previewPost.content}
              imageUrl={previewPost.imageUrl || undefined}
              isCarousel={previewPost.isCarousel ?? false}
              carouselSlides={previewPost.carouselSlides ?? []}
              brandName={getBrandName(previewPost.brandId)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openEdit(previewPost); setPreviewPost(null); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Post
            </Button>
            <DialogClose asChild><Button>Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{getBrandName(post.brandId)}</Badge>
                      <Badge variant={statusVariant(post.status)} className="text-xs">
                        {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {CONTENT_TYPE_LABELS[post.contentType as keyof typeof CONTENT_TYPE_LABELS]}
                      </Badge>
                      {post.aiGenerated && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">AI</Badge>}
                      {!post.imageUrl && (
                        <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30 bg-yellow-500/5">
                          <ImageOff className="h-3 w-3 mr-1" /> No Image
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {post.scheduledAt && (
                        <span>Scheduled: {new Date(post.scheduledAt).toLocaleString()}</span>
                      )}
                      {post.platforms && (
                        <span className="flex items-center gap-1">
                          {(post.platforms as string[]).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.imageUrl && (
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-secondary mr-2">
                        <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => setPreviewPost(post)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(post)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                      if (confirm("Delete this post?")) deletePost.mutate({ id: post.id });
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">
              {needsImageOnly ? "All posts have images" : "No posts found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {needsImageOnly
                ? "Every post in this view already has an image attached."
                : "Create your first post or generate one with AI"}
            </p>
            {!needsImageOnly && (
              <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Create Post
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
