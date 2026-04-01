import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Plus, Trash2, Facebook, Instagram, Link2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { META_APP_ID } from "@shared/types";

export default function AdminSocial() {
  const utils = trpc.useUtils();
  const { data: brands } = trpc.brand.list.useQuery();
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState({
    brandId: "", platform: "facebook" as "facebook" | "instagram",
    platformAccountId: "", accountName: "", accessToken: "",
    pageId: "", instagramBusinessId: "",
  });

  const brandId = selectedBrand ? parseInt(selectedBrand) : undefined;
  const { data: accounts, isLoading } = trpc.social.listByBrand.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );

  const connectAccount = trpc.social.connect.useMutation({
    onSuccess: () => {
      utils.social.listByBrand.invalidate();
      toast.success("Account connected");
      setConnectOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectAccount = trpc.social.disconnect.useMutation({
    onSuccess: () => {
      utils.social.listByBrand.invalidate();
      toast.success("Account disconnected");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleConnect = () => {
    if (!form.brandId || !form.platformAccountId || !form.accessToken) return;
    connectAccount.mutate({
      brandId: parseInt(form.brandId),
      platform: form.platform,
      platformAccountId: form.platformAccountId,
      accountName: form.accountName || undefined,
      accessToken: form.accessToken,
      pageId: form.pageId || undefined,
      instagramBusinessId: form.instagramBusinessId || undefined,
    });
  };

  const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + "/api/meta/callback")}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Social Accounts
          </h1>
          <p className="text-muted-foreground">Connect Facebook and Instagram accounts to brands</p>
        </div>
      </div>

      {/* Meta OAuth Info & Connect Buttons */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Link2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Meta API Integration</p>
              <p className="text-xs text-muted-foreground mb-3">
                Connect Facebook Pages and Instagram Business accounts via Meta Graph API. Use the OAuth buttons below to authorize, or manually enter tokens in the connect dialog.
              </p>
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => window.open(oauthUrl, "_blank", "width=600,height=700")}
                >
                  <Facebook className="h-4 w-4" /> Connect Facebook via OAuth
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                  onClick={() => window.open(oauthUrl, "_blank", "width=600,height=700")}
                >
                  <Instagram className="h-4 w-4" /> Connect Instagram via OAuth
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Meta App ID: <code className="text-primary">{META_APP_ID}</code> — OAuth callback will exchange the code for page tokens automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a brand" /></SelectTrigger>
          <SelectContent>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedBrand && (
          <Button className="gap-2" onClick={() => {
            setForm({ ...form, brandId: selectedBrand });
            setConnectOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Connect Account
          </Button>
        )}
      </div>

      {/* Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect Social Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v: any) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account/Page ID *</Label>
              <Input value={form.platformAccountId} onChange={(e) => setForm({ ...form, platformAccountId: e.target.value })} placeholder="e.g., 123456789" />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="e.g., GMK Web Solutions" />
            </div>
            <div className="space-y-2">
              <Label>Access Token *</Label>
              <Input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="Page access token" />
            </div>
            {form.platform === "facebook" && (
              <div className="space-y-2">
                <Label>Page ID</Label>
                <Input value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} placeholder="Facebook Page ID" />
              </div>
            )}
            {form.platform === "instagram" && (
              <div className="space-y-2">
                <Label>Instagram Business ID</Label>
                <Input value={form.instagramBusinessId} onChange={(e) => setForm({ ...form, instagramBusinessId: e.target.value })} placeholder="IG Business Account ID" />
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleConnect} disabled={!form.platformAccountId || !form.accessToken || connectAccount.isPending}>
              {connectAccount.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connected Accounts */}
      {selectedBrand ? (
        isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary">
                        {account.platform === "facebook" ? (
                          <Facebook className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Instagram className="h-5 w-5 text-pink-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{account.accountName || account.platformAccountId}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs capitalize">{account.platform}</Badge>
                          <Badge variant={account.isConnected ? "default" : "destructive"} className="text-xs">
                            {account.isConnected ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Disconnect this account?")) disconnectAccount.mutate({ id: account.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No accounts connected</h3>
              <p className="text-sm text-muted-foreground mb-4">Connect a Facebook or Instagram account to start posting</p>
              <Button onClick={() => { setForm({ ...form, brandId: selectedBrand }); setConnectOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Connect Account
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Select a brand</h3>
            <p className="text-sm text-muted-foreground">Choose a brand to manage its social accounts</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
