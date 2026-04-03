import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  UserCheck, MessageSquare, Phone, Mail, Clock, Calendar,
  Instagram, Facebook, ChevronDown, Settings, Bot, RefreshCw,
  Filter, Search
} from "lucide-react";
// Lead type inferred from tRPC output
type Lead = {
  id: number;
  brandId: number;
  senderId: string;
  platform: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  serviceNeeded: string | null;
  preferredTime: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  conversationId?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  qualified: "bg-green-500/10 text-green-400 border-green-500/20",
  closed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  spam: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  closed: "Closed",
  spam: "Spam",
};

function LeadCard({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [status, setStatus] = useState(lead.status);
  const utils = trpc.useUtils();

  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead updated");
      utils.leads.list.invalidate();
      setIsOpen(false);
      onUpdate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({ id: lead.id, status: status as any, notes });
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {lead.platform === "instagram" ? (
                  <Instagram className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                ) : (
                  <Facebook className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                )}
                <span className="font-medium text-sm truncate">{lead.name ?? "Unknown"}</span>
                <Badge className={`text-xs border ${STATUS_COLORS[lead.status]} shrink-0`} variant="outline">
                  {STATUS_LABELS[lead.status]}
                </Badge>
              </div>
              {lead.serviceNeeded && (
                <p className="text-xs text-muted-foreground truncate mb-1">
                  <span className="text-foreground/60">Service:</span> {lead.serviceNeeded}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {lead.phone}
                  </span>
                )}
                {lead.preferredTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {lead.preferredTime}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              {new Date(lead.createdAt).toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Lead Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Name</span>
                <p className="font-medium">{lead.name ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Platform</span>
                <p className="font-medium capitalize">{lead.platform}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Service Needed</span>
                <p className="font-medium">{lead.serviceNeeded ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Preferred Time</span>
                <p className="font-medium">{lead.preferredTime ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="font-medium">{lead.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{lead.phone ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sender ID</span>
                <p className="font-mono text-xs text-muted-foreground truncate">{lead.senderId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Received</span>
                <p className="font-medium">{new Date(lead.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChatbotSettings({ brandId }: { brandId: number }) {
  const { data: flow, isLoading } = trpc.leads.getChatbotFlow.useQuery({ brandId });
  const utils = trpc.useUtils();

  const DEFAULT_MESSAGES = {
    greeting: "Hey! Thanks for reaching out. What service are you interested in?",
    askName: "Great! What's your name?",
    askContact: "What's the best way to reach you? (phone number or email)",
    askTime: "What time works best for a quick call or follow-up?",
    closingMessage: "Got it! Someone from the team will be in touch within 24 hours. We appreciate you reaching out!",
  };

  const [form, setForm] = useState({
    greeting: flow?.greeting ?? DEFAULT_MESSAGES.greeting,
    askName: flow?.askName ?? DEFAULT_MESSAGES.askName,
    askContact: flow?.askContact ?? DEFAULT_MESSAGES.askContact,
    askTime: flow?.askTime ?? DEFAULT_MESSAGES.askTime,
    closingMessage: flow?.closingMessage ?? DEFAULT_MESSAGES.closingMessage,
    isActive: flow?.isActive ?? true,
  });

  const saveMutation = trpc.leads.saveChatbotFlow.useMutation({
    onSuccess: () => {
      toast.success("Chatbot settings saved");
      utils.leads.getChatbotFlow.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div>
          <p className="font-medium text-sm">Chatbot Active</p>
          <p className="text-xs text-muted-foreground">When off, incoming DMs will not trigger the chatbot</p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
        />
      </div>

      {(["greeting", "askName", "askContact", "askTime", "closingMessage"] as const).map((field) => {
        const labels: Record<string, string> = {
          greeting: "Greeting / First Message",
          askName: "Ask for Name",
          askContact: "Ask for Contact Info",
          askTime: "Ask for Preferred Time",
          closingMessage: "Closing Message",
        };
        return (
          <div key={field} className="space-y-1.5">
            <Label className="text-sm">{labels[field]}</Label>
            <Textarea
              value={form[field] as string}
              onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
              rows={2}
              className="text-sm"
            />
          </div>
        );
      })}

      <Button
        onClick={() => saveMutation.mutate({ brandId, ...form })}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? "Saving..." : "Save Chatbot Settings"}
      </Button>
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>();

  const { data: brands } = trpc.brand.list.useQuery();
  const { data: leads = [], refetch, isLoading } = trpc.leads.list.useQuery(
    selectedBrandId ? { brandId: selectedBrandId } : undefined,
    { refetchInterval: 30000 } // Poll every 30s for new leads
  );

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !search ||
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.includes(search) ||
      lead.serviceNeeded?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeBrandId = selectedBrandId ?? brands?.[0]?.id;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Leads
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              DM chatbot leads captured from Instagram and Facebook Messenger
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["new", "contacted", "qualified", "closed", "spam"] as const).map(s => (
            <Card key={s} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-muted-foreground capitalize">{s}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Chatbot Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && brands && brands.length > 1 && (
                <Select
                  value={selectedBrandId?.toString() ?? "all"}
                  onValueChange={(v) => setSelectedBrandId(v === "all" ? undefined : parseInt(v))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Lead list */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="font-medium text-muted-foreground">
                    {leads.length === 0 ? "No leads yet" : "No leads match your filters"}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {leads.length === 0
                      ? "Leads will appear here when someone DMs your connected Instagram or Facebook account."
                      : "Try adjusting your search or filter."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onUpdate={refetch} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chatbot" className="mt-4">
            {activeBrandId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-5 w-5 text-primary" />
                    DM Chatbot Configuration
                  </CardTitle>
                  <CardDescription>
                    Customize the messages your chatbot sends when someone DMs your Instagram or Facebook account.
                    The chatbot collects their name, service interest, contact info, and preferred time — then notifies you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isAdmin && brands && brands.length > 1 && (
                    <div className="mb-5">
                      <Label>Brand</Label>
                      <Select
                        value={activeBrandId.toString()}
                        onValueChange={(v) => setSelectedBrandId(parseInt(v))}
                      >
                        <SelectTrigger className="w-full mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map(b => (
                            <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <ChatbotSettings brandId={activeBrandId} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No brand found. Create a brand first.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
