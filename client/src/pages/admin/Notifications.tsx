import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, Pause, Pencil, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

const typeIcons: Record<string, any> = {
  pause_request: Pause,
  edit_request: Pencil,
  approval: CheckCircle,
  rejection: XCircle,
  post_published: CheckCircle,
  post_failed: AlertTriangle,
  system: Info,
};

const typeColors: Record<string, string> = {
  pause_request: "text-orange-400",
  edit_request: "text-blue-400",
  approval: "text-emerald-400",
  rejection: "text-red-400",
  post_published: "text-emerald-400",
  post_failed: "text-red-400",
  system: "text-muted-foreground",
};

export default function AdminNotifications() {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.notification.list.useQuery({ limit: 50 });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { utils.notification.list.invalidate(); utils.notification.unreadCount.invalidate(); toast.success("All marked as read"); },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground">{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate({})} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] || Info;
            const color = typeColors[notif.type] || "text-muted-foreground";
            return (
              <Card
                key={notif.id}
                className={`transition-colors cursor-pointer ${!notif.isRead ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => { if (!notif.isRead) markRead.mutate({ id: notif.id }); }}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-secondary shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{notif.title}</p>
                        {!notif.isRead && <Badge variant="default" className="text-[10px] h-4 px-1">New</Badge>}
                      </div>
                      {notif.message && <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">All clear</h3>
            <p className="text-sm text-muted-foreground">No notifications yet. Client requests and system alerts will appear here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
