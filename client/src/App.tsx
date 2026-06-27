import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import AgentEdit from "./pages/AgentEdit";
import Playground from "./pages/Playground";
import Inbox from "./pages/Inbox";
import Tickets from "./pages/Tickets";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import KnowledgeBase from "./pages/KnowledgeBase";
import Analytics from "./pages/Analytics";
import EmbedCode from "./pages/EmbedCode";
import Affiliate from "./pages/Affiliate";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </OnboardingGate>
        </AuthGate>
      )} />
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
      <Route path="/campaigns" component={() => (
        <AuthGate>
          <OnboardingGate>
            <AppLayout>
              <Campaigns />
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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
