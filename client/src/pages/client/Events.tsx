import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, MapPin,
  Clock, Link2, Repeat, Lock, Edit, Trash2
} from "lucide-react";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "One-time",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export default function ClientEvents() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", location: "", eventDate: "", eventTime: "19:00",
    endDate: "", endTime: "", ticketUrl: "", recurrence: "none",
    promoLeadDays: "3", includeRecap: true,
  });

  const { data: brands } = trpc.brand.list.useQuery();
  const clientBrand = brands?.[0];
  const isPremium = clientBrand?.clientTier === "premium";

  const { data: events, refetch } = trpc.event.upcoming.useQuery(
    { brandId: clientBrand?.id, days: 365 },
    { enabled: !!clientBrand }
  );

  const createEvent = trpc.event.create.useMutation({
    onSuccess: () => { toast.success("Event created"); setShowCreateDialog(false); resetForm(); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateEvent = trpc.event.update.useMutation({
    onSuccess: () => { toast.success("Event updated"); setEditingEvent(null); setShowCreateDialog(false); resetForm(); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEvent = trpc.event.delete.useMutation({
    onSuccess: () => { toast.success("Event deleted"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ name: "", description: "", location: "", eventDate: "", eventTime: "19:00", endDate: "", endTime: "", ticketUrl: "", recurrence: "none", promoLeadDays: "3", includeRecap: true });
    setEditingEvent(null);
  }

  function openEdit(event: any) {
    if (!isPremium) { toast.info("Upgrade to Premium to edit events"); return; }
    const ed = new Date(event.eventDate);
    setForm({
      name: event.name, description: event.description || "", location: event.location || "",
      eventDate: ed.toISOString().split("T")[0], eventTime: ed.toTimeString().slice(0, 5),
      endDate: event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : "",
      endTime: event.endDate ? new Date(event.endDate).toTimeString().slice(0, 5) : "",
      ticketUrl: event.ticketUrl || "", recurrence: event.recurrence || "none",
      promoLeadDays: String(event.promoLeadDays || 3), includeRecap: event.includeRecap ?? true,
    });
    setEditingEvent(event);
    setShowCreateDialog(true);
  }

  function handleSubmit() {
    if (!form.name || !form.eventDate || !clientBrand) return;
    const eventDate = new Date(`${form.eventDate}T${form.eventTime}`);
    const leadDays = parseInt(form.promoLeadDays) || 3;
    const promoLeadDaysArray = leadDays >= 3 ? [leadDays, 1, 0] : leadDays >= 2 ? [leadDays, 0] : [0];
    const payload = {
      brandId: clientBrand.id, name: form.name,
      description: form.description || undefined, location: form.location || undefined,
      eventDate: eventDate.toISOString(),
      eventEndDate: form.endDate ? new Date(`${form.endDate}T${form.endTime || "23:59"}`).toISOString() : undefined,
      ticketLink: form.ticketUrl || undefined, recurrence: form.recurrence as any,
      promoLeadDays: promoLeadDaysArray, includeRecap: form.includeRecap,
    };
    if (editingEvent) updateEvent.mutate({ id: editingEvent.id, ...payload });
    else createEvent.mutate(payload);
  }

  // Calendar
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    while (days.length < 42) days.push({ date: new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1), isCurrentMonth: false });
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (events) {
      for (const ev of events) {
        const key = new Date(ev.eventDate).toISOString().split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      }
    }
    return map;
  }, [events]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <span className="text-sm text-muted-foreground block mt-1">
            {isPremium ? "Create and manage your events" : "View your upcoming events"}
          </span>
        </div>
        {isPremium && (
          <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle>
                <DialogDescription>Events will auto-generate promotion posts leading up to the date.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Event Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Event name" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date *</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></div>
                  <div><Label>Time</Label><Input type="time" value={form.eventTime} onChange={(e) => setForm({ ...form, eventTime: e.target.value })} /></div>
                </div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Ticket / Booking Link</Label><Input value={form.ticketUrl} onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })} /></div>
                <div>
                  <Label>Recurrence</Label>
                  <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">One-time</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Promo Lead Days</Label>
                  <Select value={form.promoLeadDays} onValueChange={(v) => setForm({ ...form, promoLeadDays: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Post-Event Recap</Label>
                  <Switch checked={form.includeRecap} onCheckedChange={(v) => setForm({ ...form, includeRecap: v })} />
                </div>
                <Button onClick={handleSubmit} className="w-full" disabled={createEvent.isPending || updateEvent.isPending}>
                  {createEvent.isPending || updateEvent.isPending ? "Saving..." : editingEvent ? "Update" : "Create Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {!isPremium && (
          <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Managed — View Only</Badge>
        )}
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              const key = day.date.toISOString().split("T")[0];
              const dayEvents = eventsByDate[key] || [];
              const isToday = key === today;
              return (
                <div key={i} className={`bg-card min-h-[70px] p-1.5 ${!day.isCurrentMonth ? "opacity-40" : ""} ${isToday ? "ring-1 ring-primary ring-inset" : ""}`}>
                  <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{day.date.getDate()}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev: any) => (
                      <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary truncate" title={ev.name}>
                        <CalendarDays className="h-2.5 w-2.5 inline mr-0.5" />{ev.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Events</CardTitle>
          <CardDescription>{events?.length || 0} events</CardDescription>
        </CardHeader>
        <CardContent>
          {!events ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming events.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event: any) => {
                const eventDate = new Date(event.eventDate);
                const isPast = eventDate < new Date();
                return (
                  <div key={event.id} className={`border rounded-lg p-4 ${isPast ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{event.name}</h3>
                          {event.recurrence !== "none" && (
                            <Badge variant="outline" className="text-xs"><Repeat className="h-3 w-3 mr-1" />{RECURRENCE_LABELS[event.recurrence]}</Badge>
                          )}
                          {isPast && <Badge variant="secondary" className="text-xs">Past</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          {event.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
                          {event.ticketUrl && <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />Tickets</span>}
                        </div>
                        {event.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>}
                      </div>
                      {isPremium && (
                        <div className="flex items-center gap-1 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(event)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) deleteEvent.mutate({ id: event.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
