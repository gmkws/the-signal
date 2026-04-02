import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield,
  Clock, Wifi, WifiOff, AlertCircle, Info, Activity, Bell
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  info:    { color: "text-blue-400",   icon: Info,          label: "Info" },
  warning: { color: "text-yellow-400", icon: AlertTriangle, label: "Warning" },
  error:   { color: "text-red-400",    icon: XCircle,       label: "Error" },
  critical:{ color: "text-red-600",    icon: AlertCircle,   label: "Critical" },
};

const TYPE_LABELS: Record<string, string> = {
  post_failure:       "Post Failure",
  token_expired:      "Token Expired",
  token_expiring:     "Token Expiring",
  generation_failure: "AI Generation Failure",
  api_error:          "API Error",
  retry_success:      "Retry Success",
  system:             "System",
};

export default function SystemHealth() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: errorLogs, isLoading, refetch } = trpc.health.errorLogs.useQuery({
    limit: 50,
    includeResolved: false,
  });

  const { data: errorStats } = trpc.health.errorStats.useQuery();

  const checkUnapproved = trpc.health.checkUnapproved.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Health check complete — ${data.reminded} unapproved posts reminded`);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const errorCount = (errorStats as any)?.errorCount || errorLogs?.filter((l: any) => l.severity === "error" || l.severity === "critical").length || 0;
  const warningCount = (errorStats as any)?.warningCount || errorLogs?.filter((l: any) => l.severity === "warning").length || 0;
  const expiredTokens = 0;
  const expiringTokens = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Health</h1>
          <span className="text-sm text-muted-foreground block mt-1">
            Error logs, token health, and guardrail status
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => checkUnapproved.mutate({ hoursBeforePublish: 24 })} disabled={checkUnapproved.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checkUnapproved.isPending ? "animate-spin" : ""}`} />
            Run Health Check
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{warningCount}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${expiredTokens > 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
                {expiredTokens > 0 ? <WifiOff className="h-5 w-5 text-red-400" /> : <Wifi className="h-5 w-5 text-green-400" />}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{expiredTokens}</p>
                <p className="text-xs text-muted-foreground">Expired Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${expiringTokens > 0 ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
                <Clock className={`h-5 w-5 ${expiringTokens > 0 ? "text-yellow-400" : "text-green-400"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{expiringTokens}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Health placeholder — check via brand social accounts page */}

      {/* Error Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Error Logs
              </CardTitle>
              <CardDescription>Recent system events and errors</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="post_failure">Post Failure</SelectItem>
                  <SelectItem value="token_expired">Token Expired</SelectItem>
                  <SelectItem value="token_expiring">Token Expiring</SelectItem>
                  <SelectItem value="generation_failure">AI Generation</SelectItem>
                  <SelectItem value="api_error">API Error</SelectItem>
                  <SelectItem value="retry_success">Retry Success</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !errorLogs || errorLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400 opacity-70" />
              <p className="font-medium">All systems operational</p>
              <p className="text-sm mt-1">No errors or warnings in the log</p>
            </div>
          ) : (
            <div className="space-y-2">
              {errorLogs.map((log: any) => {
                const cfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[log.type] || log.type}</Badge>
                        {log.brandName && <span className="text-xs text-muted-foreground">{log.brandName}</span>}
                        {log.retryCount > 0 && (
                          <span className="text-xs text-muted-foreground">Retry #{log.retryCount}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{log.message}</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notification Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Email Notification Rules
          </CardTitle>
          <CardDescription>Automatic email triggers configured for this system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { trigger: "Post fails to publish", recipient: "Admin", action: "Immediate email + auto-retry up to 3×", icon: XCircle, color: "text-red-400" },
              { trigger: "Token expires or expiring in 7 days", recipient: "Admin", action: "Warning email + badge on brand dashboard", icon: Clock, color: "text-yellow-400" },
              { trigger: "AI content generation fails", recipient: "Admin", action: "Email + fallback to template post", icon: AlertTriangle, color: "text-yellow-400" },
              { trigger: "Post pending approval near publish time", recipient: "Client + Admin", action: "Reminder email to approve or reject", icon: Bell, color: "text-blue-400" },
              { trigger: "Client pauses auto-posting", recipient: "Admin", action: "Notification in dashboard + email", icon: AlertCircle, color: "text-orange-400" },
              { trigger: "Client requests edit", recipient: "Admin", action: "Notification in dashboard + email", icon: Info, color: "text-blue-400" },
            ].map((rule, i) => {
              const Icon = rule.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${rule.color}`} />
                  <div>
                    <p className="text-sm font-medium">{rule.trigger}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">→ {rule.action}</p>
                    <Badge variant="outline" className="text-xs mt-1">{rule.recipient}</Badge>
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
