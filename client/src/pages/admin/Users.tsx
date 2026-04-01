import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, User } from "lucide-react";

export default function AdminUsers() {
  const { data: users, isLoading } = trpc.user.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          User Management
        </h1>
        <p className="text-muted-foreground">View and manage platform users</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : users && users.length > 0 ? (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      {user.role === "admin" ? (
                        <Shield className="h-5 w-5 text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.name || "Unnamed User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email || "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
                      {user.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Last seen: {new Date(user.lastSignedIn).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No users yet</h3>
            <p className="text-sm text-muted-foreground">Users will appear here after they sign in</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            To assign a user as a client for a brand, go to <strong>Brands</strong> and set the Client User ID in the brand settings. To promote a user to admin, update their role directly in the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
