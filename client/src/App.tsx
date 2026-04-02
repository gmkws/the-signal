import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminBrands from "./pages/admin/Brands";
import AdminCalendar from "./pages/admin/Calendar";
import AdminPosts from "./pages/admin/Posts";
import AdminAI from "./pages/admin/AIEngine";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminNotifications from "./pages/admin/Notifications";
import AdminSocial from "./pages/admin/SocialAccounts";
import AdminUsers from "./pages/admin/Users";
import AdminServiceSpotlight from "./pages/admin/ServiceSpotlight";
import AdminEvents from "./pages/admin/Events";
import AdminSystemHealth from "./pages/admin/SystemHealth";

// Client Pages
import ClientDashboard from "./pages/client/Dashboard";
import ClientCalendar from "./pages/client/Calendar";
import ClientPosts from "./pages/client/Posts";
import ClientNotifications from "./pages/client/Notifications";
import ClientServiceSpotlight from "./pages/client/ServiceSpotlight";
import ClientEvents from "./pages/client/Events";
import ClientWelcome from "./pages/client/Welcome";

// Landing
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import AdminOnboardingApproval from "./pages/admin/OnboardingApproval";

/** Route guard: redirects non-admin users away from /admin/* routes */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "admin") {
    return <Redirect to="/client" />;
  }
  return <>{children}</>;
}

/** Route guard: redirects admin users away from /client/* routes to /admin */
function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role === "admin") {
    return <Redirect to="/admin" />;
  }
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading The Signal...</p>
      </div>
    </div>
  );
}

function AuthRouter() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) return <LoadingScreen />;

  // Unauthenticated: allow landing page and onboarding (with invite token)
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/onboarding" component={Onboarding} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <DashboardLayout>
      <Switch>
        {/* Onboarding — accessible to all authenticated users */}
        <Route path="/onboarding" component={Onboarding} />

        {/* Admin routes — guarded */}
        <Route path="/admin">
          <AdminGuard><AdminDashboard /></AdminGuard>
        </Route>
        <Route path="/admin/brands">
          <AdminGuard><AdminBrands /></AdminGuard>
        </Route>
        <Route path="/admin/calendar">
          <AdminGuard><AdminCalendar /></AdminGuard>
        </Route>
        <Route path="/admin/posts">
          <AdminGuard><AdminPosts /></AdminGuard>
        </Route>
        <Route path="/admin/ai">
          <AdminGuard><AdminAI /></AdminGuard>
        </Route>
        <Route path="/admin/analytics">
          <AdminGuard><AdminAnalytics /></AdminGuard>
        </Route>
        <Route path="/admin/notifications">
          <AdminGuard><AdminNotifications /></AdminGuard>
        </Route>
        <Route path="/admin/social">
          <AdminGuard><AdminSocial /></AdminGuard>
        </Route>
        <Route path="/admin/users">
          <AdminGuard><AdminUsers /></AdminGuard>
        </Route>
        <Route path="/admin/services">
          <AdminGuard><AdminServiceSpotlight /></AdminGuard>
        </Route>
        <Route path="/admin/events">
          <AdminGuard><AdminEvents /></AdminGuard>
        </Route>
        <Route path="/admin/system-health">
          <AdminGuard><AdminSystemHealth /></AdminGuard>
        </Route>
        <Route path="/admin/onboarding">
          <AdminGuard><AdminOnboardingApproval /></AdminGuard>
        </Route>

        {/* Client routes — guarded */}
        <Route path="/client">
          <ClientGuard><ClientDashboard /></ClientGuard>
        </Route>
        <Route path="/client/calendar">
          <ClientGuard><ClientCalendar /></ClientGuard>
        </Route>
        <Route path="/client/posts">
          <ClientGuard><ClientPosts /></ClientGuard>
        </Route>
        <Route path="/client/notifications">
          <ClientGuard><ClientNotifications /></ClientGuard>
        </Route>
        <Route path="/client/services">
          <ClientGuard><ClientServiceSpotlight /></ClientGuard>
        </Route>
        <Route path="/client/events">
          <ClientGuard><ClientEvents /></ClientGuard>
        </Route>
        <Route path="/client/welcome">
          <ClientGuard><ClientWelcome /></ClientGuard>
        </Route>

        {/* Root redirect based on role */}
        <Route path="/">
          {isAdmin ? <Redirect to="/admin" /> : <Redirect to="/client" />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AuthRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
