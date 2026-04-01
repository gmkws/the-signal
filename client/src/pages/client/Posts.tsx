import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Pause, Pencil, Check, X, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { POST_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@shared/types";

export default function ClientPosts() {
  const utils = trpc.useUtils();
  const { data: brands } = trpc.brand.list.useQuery();
  const brand = brands?.[0];
  const isPremium = brand?.clientTier === "premium";

  const { data: posts, isLoading } = trpc.post.list.useQuery(
    { brandId: brand?.id, limit: 100 },
    { enabled: !!brand }
  );

  const [viewPost, setViewPost] = useState<any>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editRequestOpen, setEditRequestOpen] = useState(false);
  const [editRequestPostId, setEditRequestPostId] = useState<number | null>(null);

  // Premium: edit post content
  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editPostId, setEditPostId] = useState<number | null>(null);

  const requestPause = trpc.notification.requestPause.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post paused — admin notified"); },
    onError: (e) => toast.error(e.message),
  });

  const requestEdit = trpc.notification.requestEdit.useMutation({
    onSuccess: () => { toast.success("Edit request sent to admin"); setEditRequestOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const reviewPost = trpc.post.review.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post reviewed"); },
    onError: (e) => toast.error(e.message),
  });

  const updatePost = trpc.post.update.useMutation({
    onSuccess: () => { utils.post.list.invalidate(); toast.success("Post updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "published": return "default" as const;
      case "scheduled": return "secondary" as const;
      case "failed": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <p className="text-muted-foreground">
          {isPremium ? "Review, edit, and approve posts for your brand" : "View scheduled and published posts for your brand"}
        </p>
      </div>

      {/* Edit Request Dialog (Managed tier) */}
      <Dialog open={editRequestOpen} onOpenChange={setEditRequestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request Edit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Describe the changes you'd like made to this post. Your account manager will be notified.</p>
            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} placeholder="What changes would you like?" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => {
              if (editRequestPostId && editNotes) requestEdit.mutate({ postId: editRequestPostId, notes: editNotes });
            }} disabled={!editNotes || requestEdit.isPending}>
              {requestEdit.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog (Premium tier) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Post</DialogTitle></DialogHeader>
          <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => {
              if (editPostId) updatePost.mutate({ id: editPostId, content: editContent });
            }} disabled={updatePost.isPending}>
              {updatePost.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Post Dialog */}
      <Dialog open={!!viewPost} onOpenChange={(v) => { if (!v) setViewPost(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post Details</DialogTitle></DialogHeader>
          {viewPost && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusVariant(viewPost.status)}>
                  {POST_STATUS_LABELS[viewPost.status as keyof typeof POST_STATUS_LABELS]}
                </Badge>
                <Badge variant="secondary">
                  {CONTENT_TYPE_LABELS[viewPost.contentType as keyof typeof CONTENT_TYPE_LABELS]}
                </Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{viewPost.content}</p>
              {viewPost.imageUrl && (
                <img src={viewPost.imageUrl} alt="" className="rounded-lg w-full" />
              )}
              {viewPost.scheduledAt && (
                <p className="text-xs text-muted-foreground">Scheduled: {new Date(viewPost.scheduledAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewPost(post)}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={statusVariant(post.status)} className="text-xs">
                        {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {CONTENT_TYPE_LABELS[post.contentType as keyof typeof CONTENT_TYPE_LABELS]}
                      </Badge>
                      {post.aiGenerated && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">AI</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-2">{post.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {post.scheduledAt ? `Scheduled: ${new Date(post.scheduledAt).toLocaleString()}` : "No date set"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.imageUrl && (
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-secondary mr-2">
                        <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    {/* Actions based on tier */}
                    {isPremium ? (
                      <>
                        {post.status === "pending_review" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-400" title="Approve"
                              onClick={() => reviewPost.mutate({ id: post.id, action: "approve" })}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" title="Reject"
                              onClick={() => reviewPost.mutate({ id: post.id, action: "reject" })}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                          onClick={() => { setEditPostId(post.id); setEditContent(post.content); setEditOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {(post.status === "scheduled" || post.status === "approved") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-400" title="Pause"
                            onClick={() => requestPause.mutate({ postId: post.id })}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Request Edit"
                          onClick={() => { setEditRequestPostId(post.id); setEditNotes(""); setEditRequestOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewPost(post)}>
                      <Eye className="h-3.5 w-3.5" />
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
            <h3 className="text-lg font-semibold mb-1">No posts yet</h3>
            <p className="text-sm text-muted-foreground">Your content team is preparing posts for your brand. Check back soon!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
