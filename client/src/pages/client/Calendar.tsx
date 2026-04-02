import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { POST_STATUS_LABELS } from "@shared/types";
import { trpc } from "@/lib/trpc";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ClientCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: brands } = trpc.brand.list.useQuery();
  const brand = brands?.[0];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const { data: posts } = trpc.post.list.useQuery(
    { brandId: brand?.id, limit: 200 },
    { enabled: !!brand }
  );

  const { data: upcomingEvents } = trpc.event.upcoming.useQuery(
    { brandId: brand?.id, days: 60 },
    { enabled: !!brand }
  );

  const getEventsForDate = (date: Date) => {
    if (!upcomingEvents) return [];
    return upcomingEvents.filter((e: any) => {
      const ed = new Date(e.eventDate);
      return ed.getFullYear() === date.getFullYear() &&
        ed.getMonth() === date.getMonth() &&
        ed.getDate() === date.getDate();
    });
  };

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const getPostsForDate = (date: Date) => {
    if (!posts) return [];
    return posts.filter((p) => {
      const postDate = p.scheduledAt ? new Date(p.scheduledAt) : new Date(p.createdAt);
      return postDate.getFullYear() === date.getFullYear() && postDate.getMonth() === date.getMonth() && postDate.getDate() === date.getDate();
    });
  };

  const today = new Date();
  const isToday = (date: Date) => date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

  const statusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "scheduled": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "pending_review": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
        <p className="text-muted-foreground">{brand?.name ? `Viewing schedule for ${brand.name}` : "Your content schedule"}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[180px] text-center">{MONTHS[month]} {year}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-2">Today</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day) => (
              <div key={day} className="p-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayPosts = getPostsForDate(day.date);
              const dayEvents = getEventsForDate(day.date);
              return (
                <div key={idx} className={`min-h-[90px] p-2 border-b border-r border-border ${!day.isCurrentMonth ? "opacity-30" : ""} ${isToday(day.date) ? "bg-primary/5" : ""}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday(day.date) ? "text-primary" : "text-muted-foreground"}`}>{day.date.getDate()}</div>
                  <div className="space-y-1">
                    {dayEvents.map((ev: any) => (
                      <div key={`ev-${ev.id}`} className="text-[10px] px-1.5 py-0.5 rounded border truncate bg-violet-500/20 text-violet-400 border-violet-500/30 flex items-center gap-0.5" title={ev.name}>
                        <CalendarDays className="h-2.5 w-2.5 flex-shrink-0" />{ev.name.substring(0, 10)}
                      </div>
                    ))}
                    {dayPosts.slice(0, 2).map((post) => (
                      <div key={post.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${statusColor(post.status)}`}>
                        {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS]}
                      </div>
                    ))}
                    {dayPosts.length > 2 && <div className="text-[10px] text-muted-foreground text-center">+{dayPosts.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
