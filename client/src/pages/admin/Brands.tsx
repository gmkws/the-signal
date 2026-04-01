import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Pencil, Trash2, Globe, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MAX_BRANDS } from "@shared/types";

const defaultVoice = {
  tone: "Professional, direct, no-fluff",
  style: "Educational, value-first",
  keywords: [] as string[],
  avoidWords: [] as string[],
  samplePosts: [] as string[],
  customInstructions: "",
};

export default function AdminBrands() {
  const utils = trpc.useUtils();
  const { data: brands, isLoading } = trpc.brand.list.useQuery();
  const createBrand = trpc.brand.create.useMutation({
    onSuccess: () => { utils.brand.list.invalidate(); toast.success("Brand created"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateBrand = trpc.brand.update.useMutation({
    onSuccess: () => { utils.brand.list.invalidate(); toast.success("Brand updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBrand = trpc.brand.delete.useMutation({
    onSuccess: () => { utils.brand.list.invalidate(); toast.success("Brand deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleAutoPost = trpc.brand.toggleAutoPost.useMutation({
    onSuccess: () => { utils.brand.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", slug: "", industry: "", location: "Hillsboro, OR", website: "",
    clientTier: "managed" as "managed" | "premium",
    tone: defaultVoice.tone, style: defaultVoice.style,
    keywords: "", avoidWords: "", customInstructions: "",
  });

  const resetForm = () => setForm({
    name: "", slug: "", industry: "", location: "Hillsboro, OR", website: "",
    clientTier: "managed", tone: defaultVoice.tone, style: defaultVoice.style,
    keywords: "", avoidWords: "", customInstructions: "",
  });

  const handleCreate = () => {
    createBrand.mutate({
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
      industry: form.industry || undefined,
      location: form.location || undefined,
      website: form.website || undefined,
      clientTier: form.clientTier,
      voiceSettings: {
        tone: form.tone,
        style: form.style,
        keywords: form.keywords.split(",").map(s => s.trim()).filter(Boolean),
        avoidWords: form.avoidWords.split(",").map(s => s.trim()).filter(Boolean),
        samplePosts: [],
        customInstructions: form.customInstructions,
      },
    });
  };

  const handleUpdate = () => {
    if (!editBrand) return;
    updateBrand.mutate({
      id: editBrand.id,
      name: form.name || undefined,
      industry: form.industry || undefined,
      location: form.location || undefined,
      website: form.website || undefined,
      clientTier: form.clientTier,
      voiceSettings: {
        tone: form.tone,
        style: form.style,
        keywords: form.keywords.split(",").map(s => s.trim()).filter(Boolean),
        avoidWords: form.avoidWords.split(",").map(s => s.trim()).filter(Boolean),
        samplePosts: [],
        customInstructions: form.customInstructions,
      },
    });
  };

  const openEdit = (brand: any) => {
    setEditBrand(brand);
    const vs = brand.voiceSettings || defaultVoice;
    setForm({
      name: brand.name, slug: brand.slug, industry: brand.industry || "",
      location: brand.location || "", website: brand.website || "",
      clientTier: brand.clientTier,
      tone: vs.tone || "", style: vs.style || "",
      keywords: (vs.keywords || []).join(", "),
      avoidWords: (vs.avoidWords || []).join(", "),
      customInstructions: vs.customInstructions || "",
    });
    setEditOpen(true);
  };

  const BrandForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GMK Web Solutions" />
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="gmk-web-solutions" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Web Development" />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Hillsboro, OR" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Website</Label>
        <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://gmkwebsolutions.com" />
      </div>
      <div className="space-y-2">
        <Label>Client Tier</Label>
        <Select value={form.clientTier} onValueChange={(v: any) => setForm({ ...form, clientTier: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="managed">Managed (View Only)</SelectItem>
            <SelectItem value="premium">Premium (Full Access)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Brand Voice Settings
        </h4>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="Professional, direct, no-fluff" />
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <Input value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} placeholder="Educational, value-first" />
          </div>
          <div className="space-y-2">
            <Label>Keywords (comma-separated)</Label>
            <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="SEO, automation, architecture" />
          </div>
          <div className="space-y-2">
            <Label>Words to Avoid (comma-separated)</Label>
            <Input value={form.avoidWords} onChange={(e) => setForm({ ...form, avoidWords: e.target.value })} placeholder="cheap, discount, hack" />
          </div>
          <div className="space-y-2">
            <Label>Custom Instructions</Label>
            <Textarea value={form.customInstructions} onChange={(e) => setForm({ ...form, customInstructions: e.target.value })} placeholder="Additional voice guidelines..." rows={3} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Management</h1>
          <p className="text-muted-foreground">Manage client brands ({brands?.length ?? 0}/{MAX_BRANDS} slots used)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={(brands?.length ?? 0) >= MAX_BRANDS}>
              <Plus className="h-4 w-4" /> Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Brand</DialogTitle></DialogHeader>
            <BrandForm isEdit={false} />
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleCreate} disabled={!form.name || createBrand.isPending}>
                {createBrand.isPending ? "Creating..." : "Create Brand"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Brand</DialogTitle></DialogHeader>
          <BrandForm isEdit={true} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdate} disabled={updateBrand.isPending}>
              {updateBrand.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Cards */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : brands && brands.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{brand.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">/{brand.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(brand)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                    if (confirm("Delete this brand? This cannot be undone.")) deleteBrand.mutate({ id: brand.id });
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">{brand.clientTier}</Badge>
                    {brand.industry && <Badge variant="secondary" className="text-xs">{brand.industry}</Badge>}
                    {brand.location && <Badge variant="secondary" className="text-xs">{brand.location}</Badge>}
                  </div>
                  {brand.website && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" /> {brand.website}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Auto-Post</span>
                    <Switch
                      checked={brand.autoPostEnabled}
                      onCheckedChange={(checked) => toggleAutoPost.mutate({ id: brand.id, enabled: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No brands yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first client brand to get started</p>
            <Button onClick={() => { resetForm(); setOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Add First Brand
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
