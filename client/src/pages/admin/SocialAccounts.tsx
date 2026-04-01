import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Plus, Trash2, Facebook, Instagram, Link2, ShoppingBag, RefreshCw, Package, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { META_APP_ID } from "@shared/types";

export default function AdminSocial() {
  const utils = trpc.useUtils();
  const { data: brands } = trpc.brand.list.useQuery();
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [shopifyForm, setShopifyForm] = useState({ shopDomain: "", accessToken: "" });
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

  const { data: shopifyConn, isLoading: shopifyLoading } = trpc.shopify.getConnection.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );

  const { data: shopifyProducts } = trpc.shopify.listProducts.useQuery(
    { brandId: brandId!, limit: 10 },
    { enabled: !!brandId && !!shopifyConn }
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

  const connectShopify = trpc.shopify.connect.useMutation({
    onSuccess: (data) => {
      utils.shopify.getConnection.invalidate();
      toast.success(`Shopify connected: ${data.storeName || "Store"}`);
      setShopifyOpen(false);
      setShopifyForm({ shopDomain: "", accessToken: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectShopify = trpc.shopify.disconnect.useMutation({
    onSuccess: () => {
      utils.shopify.getConnection.invalidate();
      utils.shopify.listProducts.invalidate();
      toast.success("Shopify disconnected");
    },
    onError: (e) => toast.error(e.message),
  });

  const syncProducts = trpc.shopify.syncProducts.useMutation({
    onSuccess: (data) => {
      utils.shopify.listProducts.invalidate();
      toast.success(`Synced ${data.synced} products from Shopify`);
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

  const handleShopifyConnect = () => {
    if (!brandId || !shopifyForm.shopDomain || !shopifyForm.accessToken) return;
    connectShopify.mutate({
      brandId,
      shopDomain: shopifyForm.shopDomain,
      accessToken: shopifyForm.accessToken,
    });
  };

  const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + "/api/meta/callback")}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Integrations
          </h1>
          <p className="text-muted-foreground">Connect social accounts and Shopify stores to brands</p>
        </div>
      </div>

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
            <Plus className="h-4 w-4" /> Connect Social
          </Button>
        )}
      </div>

      {selectedBrand ? (
        <>
          {/* Meta OAuth Info */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Link2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Meta API Integration</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Connect Facebook Pages and Instagram Business accounts via Meta Graph API.
                  </p>
                  <div className="flex items-center gap-3 mb-2">
                    <Button
                      variant="outline" size="sm"
                      className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => window.open(oauthUrl, "_blank", "width=600,height=700")}
                    >
                      <Facebook className="h-4 w-4" /> Connect Facebook via OAuth
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="gap-2 border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                      onClick={() => window.open(oauthUrl, "_blank", "width=600,height=700")}
                    >
                      <Instagram className="h-4 w-4" /> Connect Instagram via OAuth
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meta App ID: <code className="text-primary">{META_APP_ID}</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connected Social Accounts */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              Social Accounts
            </h2>
            {isLoading ? (
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
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => { if (confirm("Disconnect this account?")) disconnectAccount.mutate({ id: account.id }); }}
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
                <CardContent className="py-8 text-center">
                  <Globe className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No social accounts connected to this brand</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Shopify Connection Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              Shopify Store
            </h2>
            {shopifyLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : shopifyConn ? (
              <Card className="border-green-500/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <Store className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{shopifyConn.storeName || shopifyConn.shopDomain}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Connected</Badge>
                          <span className="text-xs text-muted-foreground">{shopifyConn.shopDomain}</span>
                          {shopifyConn.lastSyncAt && (
                            <span className="text-xs text-muted-foreground">
                              Last synced: {new Date(shopifyConn.lastSyncAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm" className="gap-2"
                        onClick={() => syncProducts.mutate({ brandId: brandId! })}
                        disabled={syncProducts.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncProducts.isPending ? "animate-spin" : ""}`} />
                        {syncProducts.isPending ? "Syncing..." : "Sync Products"}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => { if (confirm("Disconnect Shopify store? This will also remove synced products.")) disconnectShopify.mutate({ brandId: brandId! }); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Synced Products Preview */}
                  {shopifyProducts && shopifyProducts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {shopifyProducts.length} products synced — used in AI content rotation
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {shopifyProducts.slice(0, 6).map((p) => (
                          <div key={p.id} className="flex-shrink-0 w-24">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.title} className="w-24 h-24 rounded-lg object-cover border border-border" />
                            ) : (
                              <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <p className="text-xs mt-1 truncate">{p.title}</p>
                            {p.price && <p className="text-xs text-primary">${p.price}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <h3 className="text-sm font-semibold mb-1">No Shopify store connected</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect a Shopify store to pull products into the AI content rotation
                  </p>
                  <Button onClick={() => setShopifyOpen(true)} className="gap-2">
                    <ShoppingBag className="h-4 w-4" /> Connect Shopify
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Select a brand</h3>
            <p className="text-sm text-muted-foreground">Choose a brand to manage its integrations</p>
          </CardContent>
        </Card>
      )}

      {/* Connect Social Account Dialog */}
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

      {/* Connect Shopify Dialog */}
      <Dialog open={shopifyOpen} onOpenChange={setShopifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-500" />
              Connect Shopify Store
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How to get your Shopify access token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to your Shopify Admin &rarr; Settings &rarr; Apps</li>
                <li>Click "Develop apps" &rarr; Create an app</li>
                <li>Configure Admin API scopes: <code>read_products</code>, <code>read_product_listings</code></li>
                <li>Install the app and copy the Admin API access token</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Label>Store Domain *</Label>
              <Input
                value={shopifyForm.shopDomain}
                onChange={(e) => setShopifyForm({ ...shopifyForm, shopDomain: e.target.value })}
                placeholder="mystore.myshopify.com"
              />
              <p className="text-xs text-muted-foreground">Enter your .myshopify.com domain or just the store name</p>
            </div>
            <div className="space-y-2">
              <Label>Admin API Access Token *</Label>
              <Input
                type="password"
                value={shopifyForm.accessToken}
                onChange={(e) => setShopifyForm({ ...shopifyForm, accessToken: e.target.value })}
                placeholder="shpat_xxxxxxxxxxxxx"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={handleShopifyConnect}
              disabled={!shopifyForm.shopDomain || !shopifyForm.accessToken || connectShopify.isPending}
              className="gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              {connectShopify.isPending ? "Connecting..." : "Connect Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
