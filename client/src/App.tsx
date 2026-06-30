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
import Analytics from "./pages/Analytics";
import EmbedCode from "./pages/EmbedCode";
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import { Terms, Privacy, Refund } from "./pages/Legal";
import TicketPortal from "./pages/TicketPortal";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import AppLayout from "./components/AppLayout";
import { UpgradeProvider } from "./components/UpgradeDialog";
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

// Inject admin-configured custom code (analytics, marketing tools, etc.) into
// the page at runtime. Scripts are recreated so they actually execute.
function injectCustomCode(html: string, target: HTMLElement, marker: string) {
  if (!html || typeof document === "undefined") return;
  if (document.querySelector(`[data-cbp-marker="${marker}"]`)) return; // already injected
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  let first = true;
  Array.from(tpl.content.childNodes).forEach((node) => {
    let el: Node;
    if (node.nodeName === "SCRIPT") {
      const src = node as HTMLScriptElement;
      const s = document.createElement("script");
      for (const a of Array.from(src.attributes)) s.setAttribute(a.name, a.value);
      if (!src.src) s.text = src.textContent || "";
      el = s;
    } else {
      el = node.cloneNode(true);
    }
    if (el instanceof HTMLElement && first) {
      el.setAttribute("data-cbp-marker", marker);
      first = false;
    }
    target.appendChild(el);
  });
}

// Embed the Chatrico chat widget, but only on the public Home and Login pages
// (never inside the authenticated dashboard). The widget script is loaded once
// the first time one of those pages is shown, then hidden via CSS elsewhere.
const CHAT_WIDGET_PATHS = ["/", "/login"];
function ChatWidget() {
  const [location] = useLocation();
  const show = CHAT_WIDGET_PATHS.includes(location);

  useEffect(() => {
    if (!show) return;
    // Config must be set before the embed script loads.
    (window as unknown as { ChatBotProConfig?: unknown }).ChatBotProConfig = {
      agentId: "116cbd55b3de9378922f4e36710c2cd2",
      apiBase: "https://chatrico.com/api",
    };
    if (!document.getElementById("chatrico-embed")) {
      const s = document.createElement("script");
      s.id = "chatrico-embed";
      s.src = "https://chatrico.com/widget/embed.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }
  }, [show]);

  // Toggle widget visibility on SPA route changes (hide on dashboard, etc.).
  useEffect(() => {
    const styleId = "chatrico-hide";
    const existing = document.getElementById(styleId);
    if (show) {
      existing?.remove();
    } else if (!existing) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = ".cbp-launcher,.cbp-panel{display:none !important;}";
      document.head.appendChild(style);
    }
  }, [show]);

  return null;
}

function CustomCodeInjector() {
  const { data } = trpc.appConfig.publicCode.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  useEffect(() => {
    if (!data) return;
    try {
      if (data.headCode) injectCustomCode(data.headCode, document.head, "head");
      if (data.bodyCode) injectCustomCode(data.bodyCode, document.body, "body");
    } catch {
      // Never let a bad snippet break the app.
    }
  }, [data]);
  return null;
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
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/refund" component={Refund} />
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
      <Route path="/support" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Support />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Capture an affiliate referral code (?ref=CODE) into a cookie so it survives
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
          <CustomCodeInjector />
          <ChatWidget />
          <UpgradeProvider>
            <Router />
          </UpgradeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
