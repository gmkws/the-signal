import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { POST_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@shared/types";
import { trpc } from "@/lib/trpc";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");

  const { data: brands } = trpc.brand.list.useQuery();
  const { data: upcomingEvents } = trpc.event.upcoming.useQuery({ days: 60 });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const fromStr = firstDay.toISOString();
  const toStr = lastDay.toISOString();

  const { data: posts } = trpc.post.list.useQuery({
    brandId: selectedBrandId !== "all" ? parseInt(selectedBrandId) : undefined,
    limit: 200,
  });

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const startDay = firstDay.getDay();
    // Fill previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Fill current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // Fill next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const getEventsForDate = (date: Date) => {
    if (!upcomingEvents) return [];
    return upcomingEvents.filter((e: any) => {
      const ed = new Date(e.eventDate);
      return ed.getFullYear() === date.getFullYear() &&
        ed.getMonth() === date.getMonth() &&
        ed.getDate() === date.getDate();
    });
  };

  const getPostsForDate = (date: Date) => {
    if (!posts) return [];
    return posts.filter((p) => {
      const postDate = p.scheduledAt ? new Date(p.scheduledAt) : new Date(p.createdAt);
      return (
        postDate.getFullYear() === date.getFullYear() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getDate() === date.getDate()
      );
    });
  };

  const today = new Date();
  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const getBrandName = (brandId: number) => {
    return brands?.find((b) => b.id === brandId)?.name || `Brand #${brandId}`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "scheduled": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "draft": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      case "pending_review": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "approved": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "failed": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "paused": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">View and manage scheduled content across all brands</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2">
            Today
          </Button>
        </div>
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands?.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day) => (
              <div key={day} className="p-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayPosts = getPostsForDate(day.date);
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 border-b border-r border-border ${
                    !day.isCurrentMonth ? "opacity-30" : ""
                  } ${isToday(day.date) ? "bg-primary/5" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday(day.date) ? "text-primary" : "text-muted-foreground"}`}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {/* Event indicators */}
                    {getEventsForDate(day.date).map((ev: any) => (
                      <div
                        key={`ev-${ev.id}`}
                        className="text-[10px] px-1.5 py-0.5 rounded border truncate bg-violet-500/20 text-violet-400 border-violet-500/30 flex items-center gap-0.5"
                        title={`EVENT: ${ev.name}`}
                      >
                        <CalendarDays className="h-2.5 w-2.5 flex-shrink-0" />
                        {ev.name.substring(0, 12)}
                      </div>
                    ))}
                    {/* Post indicators */}
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${statusColor(post.status)}`}
                        title={`${getBrandName(post.brandId)}: ${post.content.substring(0, 50)}`}
                      >
                        {getBrandName(post.brandId).substring(0, 12)}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayPosts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-violet-500/60" />
          <span className="text-xs text-muted-foreground">Event</span>
        </div>
        {["draft", "scheduled", "pending_review", "approved", "published", "failed", "paused"].map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${statusColor(status).split(" ")[0]}`} />
            <span className="text-xs text-muted-foreground">
              {POST_STATUS_LABELS[status as keyof typeof POST_STATUS_LABELS]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
