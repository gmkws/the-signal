import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Users, Copy, Plus, Loader2, Mail } from "lucide-react";

export default function OnboardingApproval() {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<"managed" | "premium">("managed");
  const [rejectReason, setRejectReason] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState<"managed" | "premium">("managed");
  const [inviteBrandName, setInviteBrandName] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);

  const { data: pending, refetch } = trpc.onboarding.getPending.useQuery();
  const { data: invites, refetch: refetchInvites } = trpc.onboarding.listInvites.useQuery();

  const approve = trpc.onboarding.approve.useMutation({
    onSuccess: () => {
      toast.success("Brand approved and activated!");
      setApproveDialogOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reject = trpc.onboarding.reject.useMutation({
    onSuccess: () => {
      toast.success("Brand rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const createInvite = trpc.onboarding.createInvite.useMutation({
    onSuccess: (data) => {
      setGeneratedInvite(`${window.location.origin}/onboarding?invite=${data.token}`);
      refetchInvites();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleApprove = (userId: number) => {
    setSelectedUserId(userId);
    setApproveDialogOpen(true);
  };

  const handleReject = (userId: number) => {
    setSelectedUserId(userId);
    setRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (!selectedUserId) return;
    approve.mutate({ userId: selectedUserId, tier: selectedTier });
  };

  const confirmReject = () => {
    if (!selectedUserId || !rejectReason.trim()) return;
    reject.mutate({ userId: selectedUserId, reason: rejectReason });
  };

  const handleCreateInvite = () => {
    createInvite.mutate({
      email: inviteEmail || undefined,
      tier: inviteTier,
      brandName: inviteBrandName || undefined,
      expiresInDays: 7,
    });
  };

  const copyInvite = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding Approvals</h1>
          <p className="text-muted-foreground mt-1">Review new brand signups and manage invite links</p>
        </div>
        <Button
          onClick={() => { setInviteDialogOpen(true); setGeneratedInvite(null); }}
          className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Invite Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pending?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending approval</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{invites?.filter(i => i.usedAt).length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Invites used</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{invites?.filter(i => !i.usedAt).length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active invite links</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Pending Brand Approvals
          </CardTitle>
          <CardDescription>New brands waiting for your review and activation</CardDescription>
        </CardHeader>
        <CardContent>
          {!pending || pending.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No pending approvals — you're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((item: any) => (
                <div key={item.userId} className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{item.brandName || "Unnamed Brand"}</p>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">Pending</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.userName || item.userEmail || `User #${item.userId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "recently"}
                    </p>
                    {item.industry && (
                      <p className="text-xs text-muted-foreground">Industry: {item.industry}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(item.userId)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item.userId)}
                      className="bg-green-500 hover:bg-green-600 text-white gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Links */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-400" />
            Invite Links
          </CardTitle>
          <CardDescription>Send these links to clients to start their brand setup</CardDescription>
        </CardHeader>
        <CardContent>
          {!invites || invites.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">No invite links created yet. Create one to onboard a new client.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invites.map((invite: any) => (
                <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                  <div className="space-y-0.5 min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      {invite.email && <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>}
                      {invite.brandName && <p className="text-sm text-muted-foreground truncate">— {invite.brandName}</p>}
                      {!invite.email && !invite.brandName && <p className="text-sm text-muted-foreground">Generic invite</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${invite.tier === "premium" ? "border-cyan-500/30 text-cyan-400" : "border-border text-muted-foreground"}`}>
                        {invite.tier}
                      </Badge>
                      {invite.usedAt ? (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">Used</Badge>
                      ) : invite.expiresAt && new Date(invite.expiresAt) < new Date() ? (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">Expired</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">Active</Badge>
                      )}
                      {invite.expiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {!invite.usedAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInvite(`${window.location.origin}/onboarding?invite=${invite.token}`)}
                      className="gap-1 flex-shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Approve Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Approving this brand will activate their account and send them a notification. Set their tier before approving.
            </p>
            <div className="space-y-2">
              <Label>Client Tier</Label>
              <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as any)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="managed">Managed — We handle everything</SelectItem>
                  <SelectItem value="premium">Premium — Full client control</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmApprove}
              disabled={approve.isPending}
              className="bg-green-500 hover:bg-green-600 text-white gap-2"
            >
              {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Approve Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Reject Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection. This will be logged for your records.
            </p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g., Incomplete information, outside service area, etc."
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmReject}
              disabled={reject.isPending || !rejectReason.trim()}
              variant="destructive"
              className="gap-2"
            >
              {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create Invite Link</DialogTitle>
          </DialogHeader>
          {generatedInvite ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Invite link created! Share this with your client:</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
                <p className="text-xs text-foreground font-mono flex-1 truncate">{generatedInvite}</p>
                <Button size="sm" variant="outline" onClick={() => copyInvite(generatedInvite)} className="flex-shrink-0 gap-1">
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This link expires in 7 days.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Client Email (optional)</Label>
                <Input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Brand Name (optional)</Label>
                <Input
                  value={inviteBrandName}
                  onChange={e => setInviteBrandName(e.target.value)}
                  placeholder="Pre-fill their brand name"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={inviteTier} onValueChange={(v) => setInviteTier(v as any)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="managed">Managed</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              {generatedInvite ? "Close" : "Cancel"}
            </Button>
            {!generatedInvite && (
              <Button
                onClick={handleCreateInvite}
                disabled={createInvite.isPending}
                className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2"
              >
                {createInvite.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
