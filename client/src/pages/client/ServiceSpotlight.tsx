import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Trash2, Edit2, MapPin, Phone, Globe, MessageSquare, ExternalLink, Image, Lock } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CTA_TYPE_LABELS } from "@shared/types";

const CTA_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3 w-3" />,
  book_online: <ExternalLink className="h-3 w-3" />,
  dm: <MessageSquare className="h-3 w-3" />,
  visit_website: <Globe className="h-3 w-3" />,
  custom: <ExternalLink className="h-3 w-3" />,
};

const emptyForm = {
  name: "",
  description: "",
  serviceAreas: "",
  specials: "",
  ctaType: "visit_website" as string,
  ctaText: "",
  ctaLink: "",
  ctaPhone: "",
  images: "",
  displayOrder: 0,
};

export default function ClientServiceSpotlight() {
  const { data: brands } = trpc.brand.list.useQuery();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Client sees their assigned brand(s)
  const brand = brands?.[0];
  const brandId = brand?.id;
  const isPremium = brand?.clientTier === "premium";

  const { data: services, isLoading } = trpc.service.list.useQuery(
    { brandId: brandId! },
    { enabled: !!brandId }
  );

  const createService = trpc.service.create.useMutation({
    onSuccess: () => { utils.service.list.invalidate(); toast.success("Service added"); closeDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const updateService = trpc.service.update.useMutation({
    onSuccess: () => { utils.service.list.invalidate(); toast.success("Service updated"); closeDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteService = trpc.service.delete.useMutation({
    onSuccess: () => { utils.service.list.invalidate(); toast.success("Service deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };

  const openEdit = (service: any) => {
    setForm({
      name: service.name,
      description: service.description || "",
      serviceAreas: (service.serviceAreas || []).join(", "),
      specials: service.specials || "",
      ctaType: service.ctaType || "visit_website",
      ctaText: service.ctaText || "",
      ctaLink: service.ctaLink || "",
      ctaPhone: service.ctaPhone || "",
      images: (service.images || []).join(", "),
      displayOrder: service.displayOrder || 0,
    });
    setEditingId(service.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const data = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      serviceAreas: form.serviceAreas.split(",").map(s => s.trim()).filter(Boolean),
      specials: form.specials.trim() || undefined,
      ctaType: form.ctaType as any,
      ctaText: form.ctaText.trim() || undefined,
      ctaLink: form.ctaLink.trim() || undefined,
      ctaPhone: form.ctaPhone.trim() || undefined,
      images: form.images.split(",").map(s => s.trim()).filter(Boolean),
      displayOrder: form.displayOrder,
    };
    if (editingId) {
      updateService.mutate({ id: editingId, ...data });
    } else {
      createService.mutate({ brandId: brandId!, ...data });
    }
  };

  if (!brand) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">No brand assigned to your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Service Spotlight
          </h1>
          <p className="text-muted-foreground">
            {isPremium
              ? "Manage your services — the AI engine uses this data to generate service-focused posts"
              : "View your services — contact your admin to make changes"}
          </p>
        </div>
        {isPremium && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        )}
      </div>

      {!isPremium && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Lock className="h-4 w-4" />
              <span>Managed tier — view only. Upgrade to Premium to edit services directly.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : services && services.length > 0 ? (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id} className={!service.isActive ? "opacity-50" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{service.name}</h3>
                      {!service.isActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      {service.ctaType && (
                        <Badge variant="outline" className="text-xs gap-1">
                          {CTA_ICONS[service.ctaType]}
                          {CTA_TYPE_LABELS[service.ctaType as keyof typeof CTA_TYPE_LABELS] || service.ctaType}
                        </Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(service.serviceAreas as string[] || []).map((area, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1">
                          <MapPin className="h-3 w-3" /> {area}
                        </Badge>
                      ))}
                    </div>
                    {service.specials && (
                      <p className="text-xs text-primary mt-2 font-medium">Special: {service.specials}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {service.ctaPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {service.ctaPhone}</span>}
                      {service.ctaLink && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {service.ctaLink}</span>}
                      {(service.images as string[] || []).length > 0 && (
                        <span className="flex items-center gap-1"><Image className="h-3 w-3" /> {(service.images as string[]).length} images</span>
                      )}
                    </div>
                  </div>
                  {isPremium && (
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(service)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => { if (confirm(`Delete "${service.name}"?`)) deleteService.mutate({ id: service.id }); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No services yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isPremium
                ? "Add your services to power AI-generated content"
                : "Your admin hasn't added any services yet"}
            </p>
            {isPremium && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> Add First Service
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog (Premium only) */}
      {isPremium && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                {editingId ? "Edit Service" : "Add Service"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Roof Repair, Deep Cleaning" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the service" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Service Areas</Label>
                <Input value={form.serviceAreas} onChange={(e) => setForm({ ...form, serviceAreas: e.target.value })} placeholder="Hillsboro, Beaverton, Portland" />
                <p className="text-xs text-muted-foreground">Comma-separated list of cities or regions</p>
              </div>
              <div className="space-y-2">
                <Label>Current Specials / Seasonal Offers</Label>
                <Input value={form.specials} onChange={(e) => setForm({ ...form, specials: e.target.value })} placeholder="e.g., 20% off spring cleaning" />
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">Call-to-Action (CTA)</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>CTA Type</Label>
                    <Select value={form.ctaType} onValueChange={(v) => setForm({ ...form, ctaType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call Now</SelectItem>
                        <SelectItem value="book_online">Book Online</SelectItem>
                        <SelectItem value="dm">Send a DM</SelectItem>
                        <SelectItem value="visit_website">Visit Website</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CTA Button Text</Label>
                    <Input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} placeholder="e.g., Book Your Free Estimate" />
                  </div>
                  {form.ctaType === "call" && (
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={form.ctaPhone} onChange={(e) => setForm({ ...form, ctaPhone: e.target.value })} placeholder="(503) 555-1234" />
                    </div>
                  )}
                  {(form.ctaType === "book_online" || form.ctaType === "visit_website" || form.ctaType === "custom") && (
                    <div className="space-y-2">
                      <Label>Link / URL</Label>
                      <Input value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} placeholder="https://example.com/book" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Before/After or Project Image URLs</Label>
                <Textarea value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} placeholder="Paste image URLs, comma-separated" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleSubmit} disabled={!form.name.trim() || createService.isPending || updateService.isPending}>
                {(createService.isPending || updateService.isPending) ? "Saving..." : editingId ? "Update" : "Add Service"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
