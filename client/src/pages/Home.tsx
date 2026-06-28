import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Bot, MessageSquare, Users, BookOpen, BarChart3, Code2, Zap, ShieldCheck,
  Sparkles, Check, ArrowRight, Sun, Moon, Globe, Send,
} from "lucide-react";

const FEATURES = [
  { icon: Bot, title: "AI agents that actually help", desc: "Train an agent on your content and let it answer customers 24/7 in your brand's voice." },
  { icon: Users, title: "Seamless human handoff", desc: "Escalate to a teammate the moment a conversation needs a human — no context lost." },
  { icon: BookOpen, title: "Per-agent knowledge base", desc: "Give each agent its own Q&A and articles, or let it learn directly from your website." },
  { icon: MessageSquare, title: "Lead capture built in", desc: "Collect name and email before a chat starts and sync every visitor into your contacts." },
  { icon: BarChart3, title: "Analytics & tickets", desc: "Track conversations, resolution and CSAT, and turn escalations into support tickets." },
  { icon: Code2, title: "Embed anywhere", desc: "One lightweight snippet works on WordPress, Webflow or plain HTML. Style it from the dashboard." },
];

const STEPS = [
  { n: "1", title: "Create your agent", desc: "Pick a tone, add your knowledge, and customize the widget's color, position and theme." },
  { n: "2", title: "Drop in one snippet", desc: "Copy the embed code once. Every setting you change later applies automatically — no re-copying." },
  { n: "3", title: "Convert & support", desc: "Your agent answers instantly, captures leads, and hands off to your team when it matters." },
];

const PLANS = [
  { id: "starter", name: "Starter", price: "Free", period: "", highlight: false, features: ["1 AI agent", "500 conversations / mo", "Basic analytics", "Embed on any site"] },
  { id: "growth", name: "Growth", price: "$49", period: "/mo", highlight: true, features: ["5 AI agents", "5,000 conversations / mo", "Advanced analytics", "Human handoff & tickets", "Lead capture"] },
  { id: "enterprise", name: "Enterprise", price: "Custom", period: "", highlight: false, features: ["Unlimited agents", "Unlimited conversations", "Custom integrations", "SLA & priority support"] },
];

export default function Home() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const primaryCta = user ? { href: "/", label: "Go to dashboard" } : { href: "/login", label: "Get started free" };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ChatBot Pro</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {toggleTheme && (
              <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle theme">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            )}
            {user ? (
              <Link href="/"><Button size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button></Link>
                <Link href="/login"><Button size="sm" className="gap-1.5">Get started <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 w-[640px] h-[640px] rounded-full bg-primary/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="gap-1.5 mb-5 border-primary/30 text-primary bg-primary/5">
              <Sparkles className="w-3.5 h-3.5" /> AI customer support, on autopilot
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Turn every visitor into a <span className="text-primary">conversation</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              ChatBot Pro is the AI chat widget for your website. Answer questions instantly, capture leads,
              and hand off to your team — all from one snippet you never have to touch again.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={primaryCta.href}>
                <Button size="lg" className="gap-2 text-base h-12 px-6">{primaryCta.label} <ArrowRight className="w-4 h-4" /></Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="text-base h-12 px-6">See features</Button>
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" /> Free plan available · No credit card required
            </p>
          </div>

          {/* Mock widget preview */}
          <div className="relative">
            <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 bg-primary">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">Support Assistant</p>
                  <span className="text-white/80 text-xs flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online</span>
                </div>
              </div>
              <div className="p-4 space-y-3 bg-muted/30">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm shadow-sm">
                  Hi! 👋 How can I help you today?
                </div>
                <div className="max-w-[80%] ml-auto rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
                  Do you integrate with WordPress?
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm shadow-sm">
                  Absolutely — paste one snippet and you're live. Want the steps?
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center gap-2 border-t border-border bg-card">
                <div className="flex-1 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">Type a message…</div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Send className="w-4 h-4 text-primary-foreground" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to support customers</h2>
          <p className="mt-3 text-muted-foreground">From first hello to resolved ticket — your AI handles the busywork so your team can focus on what matters.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Live in minutes</h2>
            <p className="mt-3 text-muted-foreground">No engineers required. Three steps from sign-up to a working widget.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "24/7", l: "Always-on support", icon: Zap },
            { v: "1 snippet", l: "Works everywhere", icon: Globe },
            { v: "30%", l: "Affiliate commission", icon: Sparkles },
            { v: "Secure", l: "Data stays yours", icon: ShieldCheck },
          ].map((s) => (
            <div key={s.l}>
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-extrabold">{s.v}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, scalable pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you grow. Cancel anytime.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={
                "rounded-2xl border p-6 bg-card relative " +
                (p.highlight ? "border-primary shadow-xl md:scale-[1.03]" : "border-border")
              }
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">Most popular</Badge>
              )}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button className="w-full mt-6" variant={p.highlight ? "default" : "outline"}>
                  {p.id === "enterprise" ? "Contact sales" : "Get started"}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-primary text-primary-foreground px-6 sm:px-12 py-14 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to put your support on autopilot?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">Set up your first AI agent in minutes and add it to your site today.</p>
          <Link href={primaryCta.href}>
            <Button size="lg" variant="secondary" className="mt-7 gap-2 h-12 px-7 text-base">{primaryCta.label} <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center"><Bot className="w-4 h-4 text-primary-foreground" /></div>
            <span className="font-semibold text-foreground">ChatBot Pro</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
