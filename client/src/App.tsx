import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Agents from "./pages/Agents";
import AgentEdit from "./pages/AgentEdit";
import Playground from "./pages/Playground";
import Inbox from "./pages/Inbox";
import Tickets from "./pages/Tickets";
import Contacts from "./pages/Contacts";
import KnowledgeBase from "./pages/KnowledgeBase";
import Analytics from "./pages/Analytics";
import EmbedCode from "./pages/EmbedCode";
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import TicketPortal from "./pages/TicketPortal";
import Settings from "./pages/Settings";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";
import { getLoginUrl } from "./const";
import { Loader2 } from "lucide-react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data: workspace, isLoading } = trpc.workspace.get.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!workspace?.onboardingCompleted) {
    return <Onboarding />;
  }

  return <>{children}</>;
}

// The public landing page lives at the index route (chatrico.com/). The
// authenticated app/dashboard is kept separate under /dashboard.
function DashboardPage() {
  return (
    <AuthGate>
      <OnboardingGate>
        <AppLayout>
          <Dashboard />
        </AppLayout>
      </OnboardingGate>
    </AuthGate>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/ticket/:id" component={({ params }) => <TicketPortal ticketId={params.id} />} />
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/onboarding" component={() => (
        <AuthGate>
          <Onboarding />
        </AuthGate>
      )} />
      <Route path="/agents" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Agents />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/agents/:id" component={({ params }) => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <AgentEdit agentId={Number(params.id)} />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/playground/:id" component={({ params }) => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Playground agentId={Number(params.id)} />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/inbox" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Inbox />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/tickets" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Tickets />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/contacts" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Contacts />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/knowledge" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <KnowledgeBase />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/analytics" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/embed" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <EmbedCode />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/affiliate" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Affiliate />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/admin" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Admin />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/settings" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Settings />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// The public site chat widget. Loads the Chatrico widget (this workspace's
// agent) on the marketing Home and Login pages only — never inside the
// dashboard. The agent is referenced by its secure public token.
const SITE_WIDGET_AGENT_ID = "116cbd55b3de9378922f4e36710c2cd2";
const SITE_WIDGET_PATHS = ["/", "/login"];

function SiteChatWidget() {
  const [location] = useLocation();
  const allowed = SITE_WIDGET_PATHS.includes(location);

  useEffect(() => {
    // Inject the widget loader once, the first time we're on an allowed page.
    if (allowed && !document.getElementById("chatrico-embed")) {
      (window as unknown as { ChatBotProConfig?: unknown }).ChatBotProConfig = {
        agentId: SITE_WIDGET_AGENT_ID,
        apiBase: "https://chatrico.com/api",
      };
      const s = document.createElement("script");
      s.id = "chatrico-embed";
      s.src = "https://chatrico.com/widget/embed.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }

    // The widget persists in the SPA once loaded, so hide it on any non-allowed
    // page (e.g. the dashboard) via CSS instead of trying to tear it down.
    const styleId = "chatrico-widget-visibility";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = allowed ? "" : ".cbp-launcher,.cbp-panel{display:none !important;}";
  }, [allowed]);

  return null;
}

function App() {
  // the GitHub OAuth round-trip and can be attributed when the visitor signs up.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{4,32}$/.test(ref)) {
        // Persist the referral code + click time for 5 days so it survives the
        // OAuth round-trip; the server re-checks the 5-day window too.
        document.cookie = `cbp_ref=${encodeURIComponent(ref)}.${Date.now()}; path=/; max-age=432000; samesite=lax`;
      }
    } catch {
      // ignore (e.g. cookies disabled)
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
          <SiteChatWidget />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
